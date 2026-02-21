/**
 * BUSINESS LOGIC AGENT
 * Responsibility: Identify flaws in business rules and workflows that
 * automated scanners miss — race conditions, price manipulation, coupon abuse,
 * state machine bypass, unbounded loops, and predictable resource IDs.
 */

'use strict';

const { businessLogicScanTool, stateTransitionAuditTool } = require('../tools/businessLogicTools');

class BusinessLogicAgent {
  constructor(logger) {
    this.name   = 'BusinessLogicAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[BusinessLogicAgent] ${msg}`); }

  /**
   * @param {object} scannerResult - from ScannerAgent
   */
  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting business logic vulnerability analysis...');

    const findings = [];
    const allFiles = scannerResult.allFiles || [];

    // ── Filter to business-relevant files ────────────────────────────────
    // Focus on: payment, order, cart, checkout, coupon, transfer, user, account
    const bizFiles = allFiles.filter(f =>
      /(?:payment|order|cart|checkout|coupon|transfer|wallet|balance|invoice|subscription|plan|product|price|amount|quantity|booking|reservation|ticket|transaction)/i.test(f.filePath) ||
      /(?:route|api|controller|service|handler)/i.test(f.filePath)
    );

    this.log(`Scanning ${bizFiles.length} business-logic files...`);

    for (const file of bizFiles) {
      try {
        const result = JSON.parse(
          await businessLogicScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(result.findings || []));
      } catch (e) {
        this.log(`Business logic scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── State transition audit across all files ───────────────────────────
    try {
      const stateResult = JSON.parse(
        await stateTransitionAuditTool.invoke({
          files: bizFiles.map(f => ({ filePath: f.filePath, content: f.content })),
        })
      );
      findings.push(...(stateResult.issues || []));
    } catch (e) {
      this.log(`State transition audit error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`Business logic analysis done in ${elapsed}ms — ${findings.length} findings`);

    return {
      bizFindings: findings,
      stats: { findingsCount: findings.length, durationMs: elapsed },
    };
  }
}

module.exports = BusinessLogicAgent;
