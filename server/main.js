const { APP_NAME, VERSION, validateConfig } = require('./config');
const { createScanFolder, generateReport } = require('./reporting/reportGenerator');
const Logger = require('./utils/logger');
const FindingsStore = require('./intelligence/findingsStore');
const ScanMemory = require('./intelligence/memory');
const Orchestrator = require('./orchestrator/orchestrator');

async function main() {
    const target = process.argv[2];

    if (!target) {
        console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║        🛡️  VulnSight-AI v${VERSION}                       ║
  ║        Agentic Web Vulnerability Auditor              ║
  ╚══════════════════════════════════════════════════════════╝

  Usage: node main.js <target-url>

  Example: node main.js http://testphp.vulnweb.com
        `);
        return;
    }

    // Validate configuration
    validateConfig();

    // Initialize
    const scanFolder = createScanFolder();
    const logger = new Logger(scanFolder);
    const findingsStore = new FindingsStore();
    const memory = new ScanMemory(target, { scanFolder });

    logger.info('══════════════════════════════════════════════════════════');
    logger.info(`  🛡️  ${APP_NAME} v${VERSION} — Agentic Web Vulnerability Auditor`);
    logger.info('══════════════════════════════════════════════════════════');
    logger.info(`Target: ${target}`);
    logger.info(`Scan ID: ${memory.scanId}`);
    logger.info(`Scan folder: ${scanFolder}`);
    logger.info('');

    // Safety warning
    logger.warn('⚠️  WARNING: This tool performs active security testing.');
    logger.warn('⚠️  Only scan targets you own or have explicit authorization to test.');
    logger.info('');
    logger.info('Starting scan...\n');

    // Run orchestrator
    const orchestrator = new Orchestrator(logger, memory, findingsStore);
    const report = await orchestrator.run(target);

    // Generate reports
    const { jsonPath, mdPath, pdfPath } = await generateReport(scanFolder, target, report);

    logger.info('');
    logger.success('══════════════════════════════════════════════════════════');
    logger.success('  ✅ Scan Complete!');
    logger.success('══════════════════════════════════════════════════════════');
    logger.success(`Total findings: ${report.findings.length}`);
    logger.success(`  🔴 Critical: ${report.statistics.bySeverity.critical}`);
    logger.success(`  🟠 High: ${report.statistics.bySeverity.high}`);
    logger.success(`  🟡 Medium: ${report.statistics.bySeverity.medium}`);
    logger.success(`  🔵 Low: ${report.statistics.bySeverity.low}`);
    logger.success(`  ⚪ Info: ${report.statistics.bySeverity.info}`);
    logger.success(`Duration: ${report.statistics.scanDuration}`);
    logger.success(`JSON Report: ${jsonPath}`);
    logger.success(`Markdown Report: ${mdPath}`);
    logger.success(`PDF Report: ${pdfPath}`);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
