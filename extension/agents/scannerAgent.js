/**
 * SCANNER AGENT
 * Responsibility: Walk the target directory, collect all scannable files,
 * read their contents, and partition them by type for downstream agents.
 *
 * This agent does NOT call the LLM — it's a deterministic file collector.
 */

'use strict';

const { listFilesTool, readFileTool, getDirectoryTreeTool, readDependencyFilesTool } = require('../tools/fileSystemTools');
const path = require('path');
const fs   = require('fs');

// ─── Priority score for a file path (lower = scan first) ────────────────────
function filePriority(filePath, mainEntry) {
  const p = filePath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  // Exact match on the project's main entry file
  if (mainEntry && filePath === mainEntry) return 0;

  // .env files — highest risk
  if (base === '.env' || base.startsWith('.env')) return 1;

  // Auth / login / password logic
  if (/\/(auth|login|register|password|session|jwt|token)/.test(p)) return 2;

  // Route / API / controller handlers
  if (/\/(routes?|api|controllers?|handlers?)/.test(p)) return 3;

  // Middleware / admin / permission
  if (/\/(middleware|admin|permission|guard|policy)/.test(p)) return 4;

  // Main entry-point name patterns when not found via package.json
  if (['index.js','index.ts','app.js','app.ts','server.js','server.ts','main.js','main.ts'].includes(base)) return 5;

  // Models / database
  if (/\/(models?|db|database|schema|entity)/.test(p)) return 6;

  // Config files
  if (/\/(config|settings|env)/.test(p) || ['.json','.yaml','.yml','.toml'].includes(path.extname(filePath))) return 7;

  // Everything else
  return 10;
}

// ─── Detect main entry point from package.json ───────────────────────────────
function detectMainEntry(targetPath) {
  try {
    const pkgPath = path.join(targetPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const main = pkg.main || pkg.module || pkg.exports;
    if (typeof main === 'string') return path.resolve(targetPath, main);
  } catch { /* no package.json or parse error */ }
  return null;
}

class ScannerAgent {
  constructor(logger) {
    this.name = 'ScannerAgent';
    this.logger = logger || console.log;
  }

  log(msg) {
    this.logger(`[ScannerAgent] ${msg}`);
  }

  /**
   * Main entry point.
   * @param {string} targetPath - Absolute path to the directory to scan
   * @param {object} options
   * @returns {Promise<object>}
   */
  async run(targetPath, options = {}) {
    const t0 = Date.now();
    this.log(`Starting scan of: ${targetPath}`);

    // ── Step 1: Get directory tree (for LLM context) ────────────────────────
    this.log('Building directory tree...');
    const treeResult = await getDirectoryTreeTool.invoke({ dirPath: targetPath, maxDepth: 5 });

    // ── Step 2: List all scannable files ─────────────────────────────────────
    this.log('Discovering files...');
    const listResult = JSON.parse(
      await listFilesTool.invoke({
        dirPath: targetPath,
        extensions: options.extensions,
        maxFileSizeKB: options.maxFileSizeKB || 300,
      })
    );
    this.log(`Found ${listResult.count} files to scan`);

    // ── Step 3: Read all file contents ────────────────────────────────────────
    this.log('Reading file contents...');
    const files = [];
    const readErrors = [];

    for (const filePath of listResult.files) {
      try {
        const fileData = JSON.parse(await readFileTool.invoke({ filePath }));
        if (fileData.error) {
          readErrors.push({ filePath, error: fileData.error });
        } else {
          files.push(fileData);
        }
      } catch (e) {
        readErrors.push({ filePath, error: e.message });
      }
    }
    this.log(`Read ${files.length} files successfully (${readErrors.length} errors)`);

    // ── Step 3b: Sort files by security relevance ─────────────────────────────
    const mainEntry = detectMainEntry(targetPath);
    if (mainEntry) this.log(`Main entry detected: ${mainEntry}`);
    files.sort((a, b) => filePriority(a.filePath, mainEntry) - filePriority(b.filePath, mainEntry));
    this.log(`File scan order: ${files.slice(0, 5).map((f) => path.basename(f.filePath)).join(', ')}${files.length > 5 ? '...' : ''}`);

    // ── Step 4: Find dependency manifests ────────────────────────────────────
    this.log('Looking for dependency manifests...');
    const depsResult = JSON.parse(
      await readDependencyFilesTool.invoke({ dirPath: targetPath })
    );
    this.log(`Found ${depsResult.count} dependency manifest(s)`);

    // ── Step 5: Partition files by type ──────────────────────────────────────
    const jsFiles = files.filter((f) =>
      ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(f.extension?.toLowerCase())
    );
    const configFiles = files.filter((f) =>
      ['.json', '.yaml', '.yml', '.env', '.toml'].includes(f.extension?.toLowerCase()) ||
      f.fileName.startsWith('.env')
    );
    const scriptFiles = files.filter((f) =>
      ['.sh', '.bash', '.ps1', '.bat'].includes(f.extension?.toLowerCase())
    );
    const templateFiles = files.filter((f) =>
      ['.html', '.ejs', '.pug', '.hbs'].includes(f.extension?.toLowerCase())
    );
    const otherFiles = files.filter((f) => {
      const ext = f.extension?.toLowerCase();
      return ![
        '.js','.jsx','.ts','.tsx','.mjs','.cjs',
        '.json','.yaml','.yml','.toml',
        '.sh','.bash','.ps1','.bat',
        '.html','.ejs','.pug','.hbs',
      ].includes(ext) && !f.fileName.startsWith('.env');
    });

    const elapsed = Date.now() - t0;
    this.log(`Scanner done in ${elapsed}ms — ${files.length} files across ${jsFiles.length} JS, ${configFiles.length} config, ${scriptFiles.length} scripts`);

    return {
      directoryTree: treeResult,
      allFiles: files,
      jsFiles,
      configFiles,
      scriptFiles,
      templateFiles,
      otherFiles,
      dependencyManifests: depsResult.manifests,
      stats: {
        totalFiles: files.length,
        jsFiles: jsFiles.length,
        configFiles: configFiles.length,
        scriptFiles: scriptFiles.length,
        templateFiles: templateFiles.length,
        readErrors: readErrors.length,
        durationMs: elapsed,
      },
      readErrors,
    };
  }
}

module.exports = ScannerAgent;
