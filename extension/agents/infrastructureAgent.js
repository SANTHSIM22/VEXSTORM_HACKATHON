/**
 * INFRASTRUCTURE AGENT
 * Responsibility: Scan DevOps/Infrastructure configuration files:
 * - Dockerfiles (root user, :latest tags, exposed ports, secrets in ENV)
 * - docker-compose (privileged mode, exposed DB ports, hardcoded secrets)
 * - .env files (weak secrets, development mode)
 * - CI/CD pipelines (unpinned actions, secrets in logs)
 * - .gitignore (missing .env exclusions)
 */

'use strict';

const path = require('path');
const { infraScanFileTool, gitignoreAuditTool } = require('../tools/infraScanTools');

const INFRA_FILE_NAMES = new Set([
  'dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.dockerignore', '.env', '.env.local', '.env.production', '.env.staging',
  '.env.example', '.gitignore', 'makefile',
]);

const INFRA_PATTERNS = [
  /dockerfile/i,
  /docker-compose/i,
  /\.github\/workflows/,
  /\.env(?:\.|$)/i,
  /kubernetes|k8s/i,
  /terraform|\.tf$/,
  /ansible/i,
];

class InfrastructureAgent {
  constructor(logger) {
    this.name   = 'InfrastructureAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[InfrastructureAgent] ${msg}`); }

  isInfraFile(filePath) {
    const base = path.basename(filePath).toLowerCase();
    return INFRA_FILE_NAMES.has(base) ||
           INFRA_PATTERNS.some(p => p.test(filePath));
  }

  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting infrastructure & DevOps security analysis...');

    const findings = [];
    const allFiles = scannerResult.allFiles || [];

    const infraFiles = allFiles.filter(f => this.isInfraFile(f.filePath));
    this.log(`Found ${infraFiles.length} infrastructure/config files`);

    for (const file of infraFiles) {
      try {
        const result = JSON.parse(
          await infraScanFileTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(result.findings || []));
      } catch (e) {
        this.log(`Infra scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── .gitignore audit ──────────────────────────────────────────────────
    try {
      const gitResult = JSON.parse(
        await gitignoreAuditTool.invoke({
          files: allFiles.map(f => ({ filePath: f.filePath, content: f.content })),
          targetPath: scannerResult.targetPath || '',
        })
      );
      findings.push(...(gitResult.issues || []));
    } catch (e) {
      this.log(`gitignore audit error: ${e.message}`);
    }

    const elapsed = Date.now() - t0;
    this.log(`Infrastructure analysis done in ${elapsed}ms — ${findings.length} findings`);

    return {
      infraFindings: findings,
      stats: { findingsCount: findings.length, durationMs: elapsed },
    };
  }
}

module.exports = InfrastructureAgent;
