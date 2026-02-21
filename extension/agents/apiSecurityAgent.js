/**
 * API SECURITY AGENT
 * Responsibility: Analyze all API routes and endpoints for:
 * - Missing rate limiting
 * - Mass assignment
 * - Excessive data exposure
 * - GraphQL introspection
 * - Error leakage
 * - Input validation gaps
 * - Security headers (helmet, CORS)
 */

'use strict';

const { apiSecurityScanTool, securityHeadersTool } = require('../tools/apiSecurityTools');

class ApiSecurityAgent {
  constructor(logger) {
    this.name   = 'ApiSecurityAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[ApiSecurityAgent] ${msg}`); }

  /**
   * @param {object} scannerResult
   */
  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting API security analysis...');

    const findings = [];
    const allFiles = scannerResult.allFiles || [];

    // ── Focus on API/route/server files ──────────────────────────────────
    const apiFiles = allFiles.filter(f =>
      /(?:route|api|controller|handler|server|app|index|middleware)/i.test(f.filePath)
    );

    this.log(`Scanning ${apiFiles.length} API-related files...`);

    for (const file of apiFiles) {
      try {
        const result = JSON.parse(
          await apiSecurityScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(result.findings || []));
      } catch (e) {
        this.log(`API security scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── Check security headers in main app files ──────────────────────────
    try {
      const headerResult = JSON.parse(
        await securityHeadersTool.invoke({
          files: allFiles.map(f => ({ filePath: f.filePath, content: f.content })),
        })
      );
      findings.push(...(headerResult.issues || []));
    } catch (e) {
      this.log(`Security headers check error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`API security analysis done in ${elapsed}ms — ${findings.length} findings`);

    return {
      apiFindings: findings,
      stats: { findingsCount: findings.length, durationMs: elapsed },
    };
  }
}

module.exports = ApiSecurityAgent;
