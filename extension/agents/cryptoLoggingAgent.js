/**
 * CRYPTO & LOGGING AGENT
 * Responsibility: Audit cryptographic implementations and logging practices.
 * Detects: weak algorithms (MD5/SHA-1/ECB), hardcoded IVs, insecure random,
 * custom crypto, sensitive data in logs, missing audit trails.
 */

'use strict';

const { cryptoScanTool, loggingScanTool } = require('../tools/cryptoLoggingTools');

class CryptoLoggingAgent {
  constructor(logger) {
    this.name   = 'CryptoLoggingAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[CryptoLoggingAgent] ${msg}`); }

  async run(scannerResult) {
    const t0 = Date.now();
    this.log('Starting cryptography & logging analysis...');

    const cryptoFindings   = [];
    const loggingFindings  = [];
    const allFiles = scannerResult.allFiles || [];

    // ── Run both scans on every source file ───────────────────────────────
    const sourceFiles = allFiles.filter(f =>
      /\.[jt]sx?$|\.py$|\.rb$|\.php$|\.go$|\.rs$/.test(f.filePath)
    );

    this.log(`Scanning ${sourceFiles.length} source files for crypto + logging issues...`);

    for (const file of sourceFiles) {
      try {
        const cr = JSON.parse(
          await cryptoScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        cryptoFindings.push(...(cr.findings || []));
      } catch (e) {
        this.log(`Crypto scan error on ${file.filePath}: ${e.message}`);
      }

      try {
        const lr = JSON.parse(
          await loggingScanTool.invoke({ filePath: file.filePath, content: file.content })
        );
        loggingFindings.push(...(lr.findings || []));
      } catch (e) {
        this.log(`Logging scan error on ${file.filePath}: ${e.message}`);
      }
    }

    const elapsed = Date.now() - t0;
    this.log(`Crypto & logging analysis done in ${elapsed}ms — ${cryptoFindings.length} crypto, ${loggingFindings.length} logging findings`);

    return {
      cryptoFindings,
      loggingFindings,
      stats: {
        cryptoFindings: cryptoFindings.length,
        loggingFindings: loggingFindings.length,
        durationMs: elapsed,
      },
    };
  }
}

module.exports = CryptoLoggingAgent;
