/**
 * FRONTEND SECURITY AGENT
 * Responsibility: Analyze React/Next.js/Vue frontend code for:
 * XSS in dynamic content, insecure localStorage, exposed env vars,
 * source maps in production, CSP misconfigurations.
 */

'use strict';

const { frontendSecurityScanTool, nextjsConfigAuditTool } = require('../tools/frontendSecurityTools');

// Frontend file extensions
const FRONTEND_EXTS = new Set(['.jsx', '.tsx', '.vue', '.html', '.svelte', '.astro']);
const FRONTEND_CONFIG_FILES = ['next.config.js', 'next.config.ts', 'next.config.mjs', 'vite.config.js', 'vite.config.ts', 'webpack.config.js', 'nuxt.config.js'];

class FrontendSecurityAgent {
  constructor(logger) {
    this.name   = 'FrontendSecurityAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[FrontendSecurityAgent] ${msg}`); }

  isFrontendFile(filePath) {
    const ext  = '.' + filePath.split('.').pop().toLowerCase();
    const base = filePath.split(/[\\/]/).pop().toLowerCase();
    return FRONTEND_EXTS.has(ext) ||
           FRONTEND_CONFIG_FILES.includes(base) ||
           /\/(?:components?|pages?|views?|src\/app|app\/|ui\/)/i.test(filePath);
  }

  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting frontend security analysis...');

    const findings = [];
    const allFiles = scannerResult.allFiles || [];

    const frontendFiles = allFiles.filter(f => this.isFrontendFile(f.filePath));
    const configFiles   = allFiles.filter(f => FRONTEND_CONFIG_FILES.includes(
      f.filePath.split(/[\\/]/).pop().toLowerCase()
    ));

    this.log(`Scanning ${frontendFiles.length} frontend files + ${configFiles.length} config files...`);

    for (const file of frontendFiles) {
      try {
        const result = JSON.parse(
          await frontendSecurityScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        findings.push(...(result.findings || []));
      } catch (e) {
        this.log(`Frontend scan error on ${file.filePath}: ${e.message}`);
      }
    }

    // ── Also scan JS files in frontend dirs ──────────────────────────────
    const jsFrontendFiles = allFiles.filter(f =>
      /\.[jt]sx?$/.test(f.filePath) &&
      /\/(?:components?|pages?|views?|hooks?|utils?|lib|store|context)/i.test(f.filePath)
    );

    for (const file of jsFrontendFiles) {
      if (!frontendFiles.includes(file)) {
        try {
          const result = JSON.parse(
            await frontendSecurityScanTool.invoke({ filePath: file.filePath, content: file.content })
          );
          findings.push(...(result.findings || []));
        } catch (e) {
          // silent
        }
      }
    }

    // ── Next.js config audit ──────────────────────────────────────────────
    if (configFiles.length > 0) {
      try {
        const configResult = JSON.parse(
          await nextjsConfigAuditTool.invoke({
            files: configFiles.map(f => ({ filePath: f.filePath, content: f.content })),
          })
        );
        findings.push(...(configResult.issues || []));
      } catch (e) {
        this.log(`Config audit error: ${e.message}`);
      }
    }

    const elapsed = Date.now() - t0;
    this.log(`Frontend analysis done in ${elapsed}ms — ${findings.length} findings`);

    return {
      frontendFindings: findings,
      stats: { findingsCount: findings.length, durationMs: elapsed },
    };
  }
}

module.exports = FrontendSecurityAgent;
