'use strict';

/**
 * GITHUB FETCHER
 * Fetches an entire GitHub repository's file tree and contents
 * via the GitHub REST API (no Git cloning needed).
 *
 * Supports:
 *  - Public repos (no token needed)
 *  - Private repos (with GITHUB_TOKEN)
 *  - Custom branches/tags/SHAs
 *
 * Output format mirrors what extension/ScannerAgent would produce
 * from a local directory scan, so all downstream agents work unchanged.
 */

const axios = require('axios');
const path  = require('path');

// File extensions to scan (mirrors extension's fileSystemTools allowed list)
const ALLOWED_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt',
  '.cs', '.cpp', '.c', '.h', '.swift',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.env',
  '.html', '.htm', '.vue', '.svelte', '.astro',
  '.sh', '.bash', '.zsh', '.ps1', '.psm1',
  '.dockerfile', '.tf', '.hcl',
  '.md', '.txt', '.cfg', '.ini', '.conf',
]);

// Files to always skip
const SKIP_NAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'composer.lock', 'Gemfile.lock', 'poetry.lock',
]);

// Max file size to fetch (in bytes)
const MAX_FILE_SIZE = 200 * 1024; // 200 KB

// Max number of files to fetch (avoid huge repos)
const MAX_FILES = 400;

/**
 * Parse owner and repo from a GitHub URL.
 * Supports:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo.git
 *  - github.com/owner/repo
 *  - owner/repo
 */
function parseGithubUrl(repoUrl) {
  const url = (repoUrl || '').trim().replace(/\.git$/, '');
  const match = url.match(/(?:github\.com[\/:])([^/]+)\/([^/]+)/);
  if (match) return { owner: match[1], repo: match[2] };
  // bare "owner/repo" form
  const bare = url.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (bare) return { owner: bare[1], repo: bare[2] };
  throw new Error(`Cannot parse GitHub URL: "${repoUrl}". Expected format: https://github.com/owner/repo`);
}

/**
 * Build Axios headers with optional GitHub token.
 */
function buildHeaders(token) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'VexStorm-SecurityScanner/1.0',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Get the default branch of a repository.
 */
async function getDefaultBranch(owner, repo, headers) {
  const res = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  return res.data.default_branch || 'main';
}

/**
 * Get the full recursive file tree via the Git Trees API.
 * Returns a flat list of blob (file) entries.
 */
async function getRepoTree(owner, repo, branch, headers) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await axios.get(url, { headers, timeout: 30000 });

  if (res.data.truncated) {
    console.warn(`[GithubFetcher] Tree is truncated for ${owner}/${repo} — only partial files returned`);
  }

  return (res.data.tree || []).filter((item) => item.type === 'blob');
}

/**
 * Determine if a file should be scanned.
 */
function shouldScanFile(filePath, size) {
  const base = path.basename(filePath);
  const ext  = path.extname(filePath).toLowerCase();

  if (SKIP_NAMES.has(base.toLowerCase())) return false;
  if (size > MAX_FILE_SIZE) return false;

  // Allow files with allowed extensions
  if (ALLOWED_EXTS.has(ext)) return true;

  // Allow dotfiles (like .env, .gitignore)
  if (base.startsWith('.')) return true;

  // Allow Dockerfile / Makefile / Procfile with no extension
  if (['dockerfile', 'makefile', 'procfile', 'jenkinsfile', 'vagrantfile'].includes(base.toLowerCase())) return true;

  return false;
}

/**
 * Priority score for a file path (lower = scan first, mirrors extension's logic).
 */
function filePriority(filePath) {
  const p = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (base === '.env' || base.startsWith('.env')) return 1;
  if (/\/(auth|login|register|password|session|jwt|token)/.test(p)) return 2;
  if (/\/(routes?|api|controllers?|handlers?)/.test(p)) return 3;
  if (/\/(middleware|admin|permission|guard|policy)/.test(p)) return 4;
  if (['index.js','index.ts','app.js','app.ts','server.js','server.ts','main.js','main.ts'].includes(base)) return 5;
  if (/\/(models?|db|database|schema|entity)/.test(p)) return 6;
  if (/\/(config|settings|env)/.test(p)) return 7;
  return 10;
}

/**
 * Fetch file content via raw.githubusercontent.com.
 * This endpoint has a separate, much more generous rate limit
 * compared to the GitHub REST API, and does not require base64 decoding.
 * Works for both public and private repos (token auth supported).
 */
async function fetchFileContent(owner, repo, branch, filePath, headers) {
  // Encode each path segment individually to preserve '/' separators
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodedPath}`;
  try {
    const res = await axios.get(url, { headers, timeout: 15000, responseType: 'text' });
    return typeof res.data === 'string' ? res.data : String(res.data);
  } catch (e) {
    if (e.response?.status === 404) return null;
    // On rate limit, wait 2 s and retry once
    if (e.response?.status === 429 || e.response?.status === 403) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const retry = await axios.get(url, { headers, timeout: 15000, responseType: 'text' });
        return typeof retry.data === 'string' ? retry.data : String(retry.data);
      } catch (_) { return null; }
    }
    throw e;
  }
}

/**
 * Main export: fetch entire repo and return in ScannerAgent-compatible format.
 *
 * @param {string} repoUrl - GitHub repo URL (e.g. https://github.com/owner/repo)
 * @param {object} options
 * @param {string} [options.branch]       - Branch/tag/SHA to scan (defaults to repo default)
 * @param {string} [options.token]        - GitHub personal access token (for private repos)
 * @param {function} [options.onProgress] - Progress callback (msg: string)
 * @returns {Promise<object>} - Same shape as extension ScannerAgent output
 */
async function fetchGithubRepo(repoUrl, options = {}) {
  const t0 = Date.now();
  const log = options.onProgress || (() => {});

  const { owner, repo } = parseGithubUrl(repoUrl);
  const token = options.token || process.env.GITHUB_TOKEN || '';
  const headers = buildHeaders(token);

  log(`Connecting to GitHub: ${owner}/${repo}`);

  // Get repo info + default branch
  let branch = options.branch;
  let repoInfo = {};
  try {
    const infoRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    repoInfo = infoRes.data;
    if (!branch) branch = repoInfo.default_branch || 'main';
  } catch (e) {
    if (e.response?.status === 404) throw new Error(`Repository not found: ${owner}/${repo}`);
    if (e.response?.status === 403) throw new Error('GitHub API rate limit exceeded or repository is private. Set GITHUB_TOKEN env var.');
    throw new Error(`GitHub API error: ${e.message}`);
  }

  log(`Fetching file tree for branch: ${branch}`);

  // Get file tree
  let treeItems;
  try {
    treeItems = await getRepoTree(owner, repo, branch, headers);
  } catch (e) {
    throw new Error(`Failed to fetch repo tree: ${e.message}`);
  }

  // Filter to scannable files
  const scannable = treeItems
    .filter((item) => shouldScanFile(item.path, item.size || 0))
    .sort((a, b) => filePriority(a.path) - filePriority(b.path))
    .slice(0, MAX_FILES);

  log(`Found ${treeItems.length} total files, scanning ${scannable.length} after filtering`);

  // Fetch file contents with concurrency limit
  const CONCURRENCY = 10;
  const allFiles = [];
  const readErrors = [];
  const depFiles = { packageJson: [], requirementsTxt: [], gemfile: [] };

  for (let i = 0; i < scannable.length; i += CONCURRENCY) {
    const batch = scannable.slice(i, i + CONCURRENCY);
    if (i % 50 === 0) log(`Fetching file contents ${i + 1} – ${Math.min(i + CONCURRENCY, scannable.length)} / ${scannable.length}...`);

    const results = await Promise.allSettled(
      batch.map(async (item) => {
        const content = await fetchFileContent(owner, repo, branch, item.path, headers);
        if (content === null) return null;

        const ext      = path.extname(item.path).toLowerCase();
        const fileName = path.basename(item.path);

        return {
          filePath:  item.path, // use relative path (from repo root)
          fileName,
          extension: ext,
          content,
          size:       item.size || 0,
          lines:      content.split('\n').length,
          sha:       item.sha,
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const file = result.value;
        allFiles.push(file);

        // Track dependency files
        const lname = file.fileName.toLowerCase();
        if (lname === 'package.json') depFiles.packageJson.push(file);
        if (lname === 'requirements.txt') depFiles.requirementsTxt.push(file);
        if (lname === 'gemfile') depFiles.gemfile.push(file);
      } else if (result.status === 'rejected') {
        readErrors.push(result.reason?.message || 'Unknown error');
      }
    }
  }

  log(`File content fetched: ${allFiles.length} files, ${readErrors.length} errors`);

  // Build directory tree string (for context)
  const treeStr = treeItems
    .slice(0, 200)
    .map((item) => item.path)
    .join('\n');

  const elapsed = Date.now() - t0;
  log(`GitHub fetch complete in ${elapsed}ms`);

  return {
    // Core output (mirrors ScannerAgent)
    allFiles,
    depFiles,
    directoryTree: treeStr,
    stats: {
      totalFiles:   allFiles.length,
      totalLines:   allFiles.reduce((s, f) => s + f.lines, 0),
      readErrors:   readErrors.length,
      durationMs:   elapsed,
    },
    // GitHub-specific metadata
    meta: {
      owner,
      repo,
      branch,
      repoUrl,
      stars:       repoInfo.stargazers_count || 0,
      language:    repoInfo.language || 'Unknown',
      description: repoInfo.description || '',
      private:     repoInfo.private || false,
    },
  };
}

module.exports = { fetchGithubRepo, parseGithubUrl };
