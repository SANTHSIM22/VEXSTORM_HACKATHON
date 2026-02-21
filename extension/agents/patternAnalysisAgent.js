/**
<<<<<<< HEAD
 * PATTERN ANALYSIS AGENT
 * Responsibility: Run all static/regex/AST tools against the scanned files.
 * No LLM calls — pure deterministic analysis. Fast and comprehensive.
 *
 * Tools used:
 *   - patternScanFileTool (regex-based OWASP patterns)
 *   - secretScanFileTool  (credential/secret detection)
 *   - astScanFileTool     (AST-level JS analysis)
 *   - auditPackageJsonTool (dependency CVE check)
=======
 * PATTERN ANALYSIS AGENT  v2
 * Responsibility: Run ALL static/regex/AST tools against the scanned files.
 * No LLM calls — pure deterministic analysis. Fast and comprehensive.
 *
 * Tools used:
 *   - patternScanFileTool     (regex-based OWASP patterns)
 *   - secretScanFileTool      (credential/secret detection)
 *   - astScanFileTool         (AST-level JS analysis)
 *   - auditPackageJsonTool    (dependency CVE check)
 *   - authScanFileTool        (auth/authz patterns)
 *   - businessLogicScanTool   (business logic flaws)
 *   - apiSecurityScanTool     (API security issues)
 *   - frontendSecurityScanTool (frontend/XSS/CSP)
 *   - infraScanFileTool       (Docker/CI/CD/Infra)
 *   - cryptoScanTool          (cryptographic weaknesses)
 *   - loggingScanTool         (logging & monitoring gaps)
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
 */

'use strict';

const { patternScanFileTool } = require('../tools/patternScanTools');
const { secretScanFileTool }   = require('../tools/secretScanTools');
const { astScanFileTool }      = require('../tools/astScanTools');
const { auditPackageJsonTool, auditRequirementsTxtTool } = require('../tools/dependencyTools');
<<<<<<< HEAD
=======
const { authScanFileTool, detectMissingAuthTool, rbacAuditTool } = require('../tools/authAnalysisTools');
const { businessLogicScanTool, stateTransitionAuditTool } = require('../tools/businessLogicTools');
const { apiSecurityScanTool, securityHeadersTool } = require('../tools/apiSecurityTools');
const { frontendSecurityScanTool, nextjsConfigAuditTool } = require('../tools/frontendSecurityTools');
const { infraScanFileTool, gitignoreAuditTool } = require('../tools/infraScanTools');
const { cryptoScanTool, loggingScanTool } = require('../tools/cryptoLoggingTools');
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe

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

<<<<<<< HEAD
    const patternFindings = [];
    const secretFindings  = [];
    const astFindings     = [];
    const depFindings     = [];
=======
    const patternFindings  = [];
    const secretFindings   = [];
    const astFindings      = [];
    const depFindings      = [];
    const authFindings     = [];
    const bizFindings      = [];
    const apiFindings      = [];
    const frontendFindings = [];
    const infraFindings    = [];
    const cryptoFindings   = [];
    const loggingFindings  = [];
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe

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
<<<<<<< HEAD
=======

      // Auth analysis
      try {
        const ar = JSON.parse(
          await authScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (ar.findings?.length > 0) authFindings.push(...ar.findings);
      } catch (e) { /* non-critical */ }

      // Business logic
      try {
        const br = JSON.parse(
          await businessLogicScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (br.findings?.length > 0) bizFindings.push(...br.findings);
      } catch (e) { /* non-critical */ }

      // API security
      try {
        const apr = JSON.parse(
          await apiSecurityScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (apr.findings?.length > 0) apiFindings.push(...apr.findings);
      } catch (e) { /* non-critical */ }

      // Frontend security
      if (/\.[jt]sx?$|\.vue$|\.html?$|\.svelte$/i.test(file.filePath)) {
        try {
          const fr = JSON.parse(
            await frontendSecurityScanTool.invoke({ filePath: file.filePath, content: file.content })
          );
          if (fr.findings?.length > 0) frontendFindings.push(...fr.findings);
        } catch (e) { /* non-critical */ }
      }

      // Infrastructure scan (Dockerfile, .env, .github, k8s, etc.)
      try {
        const ir = JSON.parse(
          await infraScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        if (ir.findings?.length > 0) infraFindings.push(...ir.findings);
      } catch (e) { /* non-critical */ }

      // Crypto & logging scan
      if (/\.[jt]sx?$|\.py$|\.rb$|\.php$|\.go$/i.test(file.filePath)) {
        try {
          const cr = JSON.parse(
            await cryptoScanTool.invoke({ filePath: file.filePath, content: file.content })
          );
          if (cr.findings?.length > 0) cryptoFindings.push(...cr.findings);
        } catch (e) { /* non-critical */ }

        try {
          const lr = JSON.parse(
            await loggingScanTool.invoke({ filePath: file.filePath, content: file.content })
          );
          if (lr.findings?.length > 0) loggingFindings.push(...lr.findings);
        } catch (e) { /* non-critical */ }
      }
    }

    // ── Cross-file auth checks ─────────────────────────────────────────────
    const routeFiles = allFiles.filter(f =>
      /routes?|api|controller|handler|middleware/i.test(f.filePath)
    );
    if (routeFiles.length > 0) {
      try {
        const mr = JSON.parse(
          await detectMissingAuthTool.invoke({
            files: routeFiles.map(f => ({ filePath: f.filePath, content: f.content }))
          })
        );
        if (mr.findings?.length > 0) authFindings.push(...mr.findings);
      } catch (e) { /* non-critical */ }
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
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
<<<<<<< HEAD
      `${patternFindings.length} pattern | ${secretFindings.length} secret | ` +
      `${astFindings.length} AST | ${depFindings.length} dependency findings`
=======
      `pattern:${patternFindings.length} | secret:${secretFindings.length} | ` +
      `AST:${astFindings.length} | dep:${depFindings.length} | auth:${authFindings.length} | ` +
      `biz:${bizFindings.length} | api:${apiFindings.length} | fe:${frontendFindings.length} | ` +
      `infra:${infraFindings.length} | crypto:${cryptoFindings.length} | log:${loggingFindings.length}`
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    );

    return {
      patternFindings,
      secretFindings,
      astFindings,
      depFindings,
<<<<<<< HEAD
      stats: {
        patternFindings: patternFindings.length,
        secretFindings:  secretFindings.length,
        astFindings:     astFindings.length,
        depFindings:     depFindings.length,
        durationMs:      elapsed,
=======
      authFindings,
      bizFindings,
      apiFindings,
      frontendFindings,
      infraFindings,
      cryptoFindings,
      loggingFindings,
      stats: {
        patternFindings:  patternFindings.length,
        secretFindings:   secretFindings.length,
        astFindings:      astFindings.length,
        depFindings:      depFindings.length,
        authFindings:     authFindings.length,
        bizFindings:      bizFindings.length,
        apiFindings:      apiFindings.length,
        frontendFindings: frontendFindings.length,
        infraFindings:    infraFindings.length,
        cryptoFindings:   cryptoFindings.length,
        loggingFindings:  loggingFindings.length,
        durationMs:       elapsed,
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      },
    };
  }
}

module.exports = PatternAnalysisAgent;
