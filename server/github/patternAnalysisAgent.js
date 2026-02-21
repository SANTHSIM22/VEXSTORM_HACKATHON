'use strict';

/**
 * PATTERN ANALYSIS AGENT — GitHub variant
 * Runs all static/regex/AST tools against GitHub-fetched files.
 * Uses standalone plain-JS scanners (no LangChain).
 */

const { scanPatterns }                               = require('./tools/patternScanner');
const { scanSecrets }                                = require('./tools/secretScanner');
const { scanAst }                                    = require('./tools/astScanner');
const { auditPackageJson, auditRequirementsTxt }     = require('./tools/dependencyScanner');
const { scanAuth, detectMissingAuth }                = require('./tools/authScanner');
const { scanBusinessLogic, auditStateTransitions }   = require('./tools/businessLogicScanner');
const { scanApiSecurity, checkSecurityHeaders }      = require('./tools/apiSecurityScanner');
const { scanFrontend, auditNextjsConfig }            = require('./tools/frontendScanner');
const { scanInfra, auditGitignore }                  = require('./tools/infraScanner');
const { scanCrypto, scanLogging }                    = require('./tools/cryptoLoggingScanner');

class PatternAnalysisAgent {
  constructor(logger) {
    this.name   = 'PatternAnalysisAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[PatternAnalysisAgent] ${msg}`); }

  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting pattern + secret + AST analysis...');

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

    const allFiles = scannerResult.allFiles || [];
    const total    = allFiles.length;

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];
      if (i % 20 === 0) this.log(`Pattern scanning ${i + 1}/${total}...`);

      // Regex pattern scan
      try {
        const pr = await scanPatterns(file.filePath, file.content);
        if (pr.findings?.length) patternFindings.push(...pr.findings);
      } catch (e) { this.log(`Pattern err ${file.filePath}: ${e.message}`); }

      // Secret scan
      try {
        const sr = await scanSecrets(file.filePath, file.content);
        if (sr.secrets?.length) secretFindings.push(...sr.secrets);
      } catch (e) { this.log(`Secret err ${file.filePath}: ${e.message}`); }

      // Auth analysis
      try {
        const ar = await scanAuth(file.filePath, file.content);
        if (ar.findings?.length) authFindings.push(...ar.findings);
      } catch (e) { /* silent */ }

      // Business logic
      try {
        const br = await scanBusinessLogic(file.filePath, file.content);
        if (br.findings?.length) bizFindings.push(...br.findings);
      } catch (e) { /* silent */ }

      // API security
      try {
        const apr = await scanApiSecurity(file.filePath, file.content);
        if (apr.findings?.length) apiFindings.push(...apr.findings);
      } catch (e) { /* silent */ }

      // Frontend security
      try {
        const fr = await scanFrontend(file.filePath, file.content);
        if (fr.findings?.length) frontendFindings.push(...fr.findings);
      } catch (e) { /* silent */ }

      // Infra scan
      try {
        const ir = await scanInfra(file.filePath, file.content);
        if (ir.findings?.length) infraFindings.push(...ir.findings);
      } catch (e) { /* silent */ }

      // Crypto scan
      try {
        const cr = await scanCrypto(file.filePath, file.content);
        if (cr.findings?.length) cryptoFindings.push(...cr.findings);
      } catch (e) { /* silent */ }

      // Logging scan
      try {
        const lr = await scanLogging(file.filePath, file.content);
        if (lr.findings?.length) loggingFindings.push(...lr.findings);
      } catch (e) { /* silent */ }

      // AST scan (JS/TS only)
      if (['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(file.extension)) {
        try {
          const astr = await scanAst(file.filePath, file.content);
          if (astr.findings?.length) astFindings.push(...astr.findings);
        } catch (e) { /* silent */ }
      }
    }

    // Dependency audit
    for (const f of (scannerResult.depFiles?.packageJson || [])) {
      try {
        const dr = await auditPackageJson(f.content, f.filePath);
        if (dr.vulnerabilities?.length) depFindings.push(...dr.vulnerabilities);
      } catch (e) { /* silent */ }
    }
    for (const f of (scannerResult.depFiles?.requirementsTxt || [])) {
      try {
        const dr = await auditRequirementsTxt(f.content, f.filePath);
        if (dr.vulnerabilities?.length) depFindings.push(...dr.vulnerabilities);
      } catch (e) { /* silent */ }
    }

    // Security headers check
    try {
      const hdr = await checkSecurityHeaders(
        allFiles.map((f) => ({ filePath: f.filePath, content: f.content }))
      );
      if (hdr.issues?.length) apiFindings.push(...hdr.issues);
    } catch (e) { /* silent */ }

    // gitignore audit
    const gitignoreFile = allFiles.find((f) => f.fileName === '.gitignore');
    if (gitignoreFile) {
      try {
        const gr = await auditGitignore(allFiles.map((f) => ({ filePath: f.filePath, content: f.content })), gitignoreFile.filePath);
        if (gr.issues?.length) infraFindings.push(...gr.issues);
      } catch (e) { /* silent */ }
    }

    // Detect missing auth on route files
    try {
      const routeFiles = allFiles.filter((f) => /(?:route|api|controller|handler)/i.test(f.filePath));
      if (routeFiles.length > 0) {
        const mar = await detectMissingAuth(
          routeFiles.map((f) => ({ filePath: f.filePath, content: f.content }))
        );
        for (const r of (mar.routes || [])) {
          authFindings.push({
            ...r,
            description: `[${r.method}] ${r.route} — route has no visible auth middleware`,
            source: 'Auth Analysis',
          });
        }
      }
    } catch (e) { /* silent */ }

    const elapsed = Date.now() - t0;
    this.log(`Pattern analysis done in ${elapsed}ms`);

    return {
      patternFindings,
      secretFindings,
      astFindings,
      depFindings,
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
      },
    };
  }
}

module.exports = PatternAnalysisAgent;
