/**
 * FILE SYSTEM TOOLS
 * Agents use these to walk directories and read source files.
 * All tools are LangChain DynamicStructuredTool instances.
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

// ─── Supported extensions ────────────────────────────────────────────────────
const DEFAULT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.php', '.java', '.go', '.rb', '.cs',
  '.env', '.json', '.yaml', '.yml', '.sh', '.bash',
  '.html', '.ejs', '.pug', '.hbs',
]);

const SKIP_DIRS = new Set([
  // package managers / build outputs
  'node_modules', 'bower_components', 'vendor', 'target',
  'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit',
  // version control / IDE
  '.git', '.svn', '.hg', '.vscode', '.idea',
  // test/coverage artifacts
  'coverage', '.nyc_output', '__pycache__', '.pytest_cache',
  // python envs
  'venv', '.venv', 'env', '.env',
  // misc generated / cache
<<<<<<< HEAD
  '.vulentry', 'logs', 'log', 'tmp', 'temp', 'cache', '.cache',
=======
  '.zerotrace', 'logs', 'log', 'tmp', 'temp', 'cache', '.cache',
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  'public', 'static', 'assets', 'migrations', 'seeds',
]);

// ─── Tool 1: List all scannable files in a directory (recursive) ─────────────
const listFilesTool = new DynamicStructuredTool({
  name: 'list_files',
  description:
    'Recursively list all source code files in a directory that are worth scanning. ' +
    'Returns an array of absolute file paths.',
  schema: z.object({
    dirPath: z.string().describe('Absolute path of the directory to scan'),
    extensions: z
      .array(z.string())
      .optional()
      .describe('File extensions to include, e.g. [".js", ".ts"]. Uses default set if omitted.'),
    maxFileSizeKB: z
      .number()
      .optional()
      .default(300)
      .describe('Skip files larger than this many KB'),
  }),
  func: async ({ dirPath, extensions, maxFileSizeKB = 300 }) => {
    const allowedExts = extensions
      ? new Set(extensions)
      : DEFAULT_EXTENSIONS;

    const results = [];

    function walk(dir) {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          // Always include .env files regardless of extension filter
          if (allowedExts.has(ext) || entry.name === '.env' || entry.name.startsWith('.env')) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size <= maxFileSizeKB * 1024) {
                results.push(fullPath);
              }
            } catch { /* skip */ }
          }
        }
      }
    }

    walk(dirPath);
    return JSON.stringify({ count: results.length, files: results });
  },
});

// ─── Tool 2: Read a single file ───────────────────────────────────────────────
const readFileTool = new DynamicStructuredTool({
  name: 'read_file',
  description:
    'Read the full content of a source file. Returns the text content and metadata.',
  schema: z.object({
    filePath: z.string().describe('Absolute path of the file to read'),
  }),
  func: async ({ filePath }) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const stat = fs.statSync(filePath);
      const lines = content.split('\n').length;
      return JSON.stringify({
        filePath,
        fileName: path.basename(filePath),
        extension: path.extname(filePath),
        sizeBytes: stat.size,
        lineCount: lines,
        content,
      });
    } catch (e) {
      return JSON.stringify({ error: `Cannot read file: ${e.message}`, filePath });
    }
  },
});

// ─── Tool 3: Get directory tree structure (non-content) ──────────────────────
const getDirectoryTreeTool = new DynamicStructuredTool({
  name: 'get_directory_tree',
  description:
    'Get a compact tree view of a project directory to understand its structure before scanning.',
  schema: z.object({
    dirPath: z.string().describe('Absolute path to show tree for'),
    maxDepth: z.number().optional().default(4).describe('Maximum depth to traverse'),
  }),
  func: async ({ dirPath, maxDepth = 4 }) => {
    const lines = [];

    function walk(dir, depth, prefix) {
      if (depth > maxDepth) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      entries.forEach((entry, i) => {
        if (SKIP_DIRS.has(entry.name)) return;
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory()) {
          walk(
            path.join(dir, entry.name),
            depth + 1,
            prefix + (isLast ? '    ' : '│   ')
          );
        }
      });
    }

    lines.push(dirPath);
    walk(dirPath, 1, '');
    return lines.join('\n');
  },
});

// ─── Tool 4: Read package.json / requirements.txt for dependency info ─────────
const readDependencyFilesTool = new DynamicStructuredTool({
  name: 'read_dependency_files',
  description:
    'Read all dependency manifest files (package.json, requirements.txt, Gemfile, go.mod, etc.) ' +
    'from a project directory to analyze third-party dependencies.',
  schema: z.object({
    dirPath: z.string().describe('Root directory of the project'),
  }),
  func: async ({ dirPath }) => {
    const manifestNames = [
      'package.json', 'package-lock.json', 'yarn.lock',
      'requirements.txt', 'Pipfile', 'Pipfile.lock',
      'Gemfile', 'Gemfile.lock',
      'go.mod', 'go.sum',
      'pom.xml', 'build.gradle',
      'composer.json', 'composer.lock',
    ];

    const found = [];

    function search(dir, depth = 0) {
      if (depth > 3) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && manifestNames.includes(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            found.push({ path: fullPath, name: entry.name, content: content.slice(0, 8000) });
          } catch { /* skip */ }
        } else if (entry.isDirectory()) {
          search(fullPath, depth + 1);
        }
      }
    }

    search(dirPath);
    return JSON.stringify({ count: found.length, manifests: found });
  },
});

module.exports = {
  listFilesTool,
  readFileTool,
  getDirectoryTreeTool,
  readDependencyFilesTool,
};
