/**
 * PATTERN ANALYSIS AGENT
 * Responsibility: Run all static/regex/AST tools against the scanned files.
 * No LLM calls — pure deterministic analysis. Fast and comprehensive.
 *
 * Tools used:
 *   - patternScanFileTool (regex-based OWASP patterns)
 *   - secretScanFileTool  (credential/secret detection)
 *   - astScanFileTool     (AST-level JS analysis)
 *   - auditPackageJsonTool (dependency CVE check)
 */

'use strict';

const { patternScanFileTool } = require('../tools/patternScanTools');
const { secretScanFileTool }   = require('../tools/secretScanTools');
const { astScanFileTool }      = require('../tools/astScanTools');
const { auditPackageJsonTool, auditRequirementsTxtTool } = require('../tools/dependencyTools');

class PatternAnalysisAgent {
  constructor(logger) {
    this.name = 'PatternAnalysisAgent';
    this.logger = logger || console.log;
  }

  log(msg) {
    this.logger(`[PatternAnalysisAgent] ${msg}`);
  }

  /**
   * @param {object} scannerResult - Output from ScannerAgent.run()
   * @returns {Promise<object>}
   */
  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting pattern + secret + AST analysis...');

    const patternFindings = [];
    const secretFindings  = [];
    const astFindings     = [];
    const depFindings     = [];

    const allFiles = scannerResult.allFiles || [];
    const total = allFiles.length;

    // ── Run pattern + secret scan on every file ──────────────────────────────
    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      if (i % 10 === 0) this.log(`Pattern scanning ${i + 1}/${total}...`);

      // Regex pattern scan
      try {
        const pr = JSON.parse(
          await patternScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (pr.findings?.length > 0) {
          patternFindings.push(...pr.findings);
        }
      } catch (e) {
        this.log(`Pattern scan error on ${file.filePath}: ${e.message}`);
      }

      // Secret scan
      try {
        const sr = JSON.parse(
          await secretScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (sr.secrets?.length > 0) {
          secretFindings.push(...sr.secrets);
        }
      } catch (e) {
        this.log(`Secret scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── AST scan only JS files ───────────────────────────────────────────────
    const jsFiles = scannerResult.jsFiles || [];
    this.log(`AST scanning ${jsFiles.length} JS files...`);

    for (const file of jsFiles) {
      try {
        const ar = JSON.parse(
          await astScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (ar.findings?.length > 0) {
          astFindings.push(...ar.findings);
        }
      } catch (e) {
        this.log(`AST scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── Dependency audit ─────────────────────────────────────────────────────
    const manifests = scannerResult.dependencyManifests || [];
    this.log(`Auditing ${manifests.length} dependency manifest(s)...`);

    for (const manifest of manifests) {
      try {
        if (manifest.name === 'package.json') {
          const dr = JSON.parse(
            await auditPackageJsonTool.invoke({ content: manifest.content, filePath: manifest.path })
          );
          if (dr.vulnerabilities?.length > 0) {
            depFindings.push(...dr.vulnerabilities);
          }
        } else if (manifest.name === 'requirements.txt') {
          const dr = JSON.parse(
            await auditRequirementsTxtTool.invoke({ content: manifest.content, filePath: manifest.path })
          );
          if (dr.vulnerabilities?.length > 0) {
            depFindings.push(...dr.vulnerabilities);
          }
        }
      } catch (e) {
        this.log(`Dependency audit error on ${manifest.path}: ${e.message}`);
      }
    }

    const elapsed = Date.now() - t0;
    this.log(
      `Pattern analysis done in ${elapsed}ms — ` +
      `${patternFindings.length} pattern | ${secretFindings.length} secret | ` +
      `${astFindings.length} AST | ${depFindings.length} dependency findings`
    );

    return {
      patternFindings,
      secretFindings,
      astFindings,
      depFindings,
      stats: {
        patternFindings: patternFindings.length,
        secretFindings:  secretFindings.length,
        astFindings:     astFindings.length,
        depFindings:     depFindings.length,
        durationMs:      elapsed,
      },
    };
  }
}

module.exports = PatternAnalysisAgent;
