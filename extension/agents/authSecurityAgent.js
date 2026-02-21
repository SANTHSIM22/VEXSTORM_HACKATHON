/**
 * AUTH SECURITY AGENT
 * Responsibility: Deep analysis of authentication, authorization (RBAC/ABAC),
 * JWT, session management, CSRF, IDOR, and privilege escalation.
 *
 * Uses authAnalysisTools deterministically + LLM for contextual reasoning.
 */

'use strict';

const { authScanFileTool, detectMissingAuthTool, rbacAuditTool } = require('../tools/authAnalysisTools');

class AuthSecurityAgent {
  constructor(logger) {
    this.name    = 'AuthSecurityAgent';
    this.logger  = logger || console.log;
  }

  log(msg) { this.logger(`[AuthSecurityAgent] ${msg}`); }

  /**
   * @param {object} scannerResult - from ScannerAgent
   */
  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting auth & access control analysis...');

    const findings = [];
    const allFiles = scannerResult.allFiles || [];

    // ── Priority files first: auth, routes, middleware ────────────────────
    const authFiles = allFiles.filter(f =>
      /(?:auth|login|register|session|jwt|token|guard|middleware|permission|role|password)/i.test(f.filePath)
    );
    const routeFiles = allFiles.filter(f =>
      /(?:route|api|controller|handler)/i.test(f.filePath)
    );

    const priorityFiles = [...new Set([...authFiles, ...routeFiles])];
    this.log(`Scanning ${priorityFiles.length} auth-relevant files...`);

    // ── Run authScanFileTool and rbacAuditTool on each file ───────────────
    for (const file of priorityFiles) {
      try {
        const authResult = JSON.parse(
          await authScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(authResult.findings || []));
      } catch (e) {
        this.log(`Auth scan error on ${file.filePath}: ${e.message}`);
      }

      try {
        const rbacResult = JSON.parse(
          await rbacAuditTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(rbacResult.issues || []));
      } catch (e) {
        this.log(`RBAC audit error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── Detect missing auth middleware across ALL route files ─────────────
    try {
      const allRoutesInput = allFiles.filter(f =>
        /(?:route|api|controller|handler)/i.test(f.filePath)
      ).map(f => ({ filePath: f.filePath, content: f.content }));

      const missingAuthResult = JSON.parse(
        await detectMissingAuthTool.invoke({ files: allRoutesInput })
      );

      for (const r of missingAuthResult.routes || []) {
        findings.push({
          ...r,
          description: `[${r.method}] ${r.route} — route has no visible auth middleware`,
          source: 'Auth Analysis',
        });
      }
      this.log(`Found ${missingAuthResult.totalExposedRoutes || 0} potentially unauthenticated routes`);
    } catch (e) {
      this.log(`Missing auth detection error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`Auth analysis done in ${elapsed}ms — ${findings.length} findings`);

    return {
      authFindings: findings,
      stats: { findingsCount: findings.length, durationMs: elapsed },
    };
  }
}

module.exports = AuthSecurityAgent;
