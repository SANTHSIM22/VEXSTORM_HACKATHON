const express = require('express');
const { APP_NAME, VERSION, validateConfig } = require('./config');
const Logger = require('./utils/logger');
const FindingsStore = require('./intelligence/findingsStore');
const ScanMemory = require('./intelligence/memory');
const Orchestrator = require('./orchestrator/orchestrator');
const { createScanFolder, generateReport } = require('./reporting/reportGenerator');

validateConfig();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Store scan results in memory
const scanResults = {};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: APP_NAME,
        version: VERSION,
        timestamp: new Date().toISOString(),
    });
});

// Start a new scan
app.post('/scan', async (req, res) => {
    const { baseURL, depth, mode } = req.body;

    if (!baseURL) {
        return res.status(400).json({ error: 'baseURL is required' });
    }

    const scanFolder = createScanFolder();
    const logger = new Logger(scanFolder);
    const findingsStore = new FindingsStore();
    const memory = new ScanMemory(baseURL, { scanFolder, depth, mode });

    logger.info(`API scan started for: ${baseURL}`);

    // Return scan ID immediately
    res.json({
        scanId: memory.scanId,
        status: 'started',
        target: baseURL,
        message: 'Scan started. Use GET /scan/:id to check progress.',
    });

    // Run scan asynchronously
    try {
        const orchestrator = new Orchestrator(logger, memory, findingsStore);
        const report = await orchestrator.run(baseURL);
        const { jsonPath, mdPath } = await generateReport(scanFolder, baseURL, report);

        scanResults[memory.scanId] = {
            status: 'completed',
            report,
            jsonPath,
            mdPath,
            completedAt: new Date().toISOString(),
        };
    } catch (err) {
        scanResults[memory.scanId] = {
            status: 'error',
            error: err.message,
            completedAt: new Date().toISOString(),
        };
    }
});

// Get scan results
app.get('/scan/:id', (req, res) => {
    const result = scanResults[req.params.id];
    if (!result) {
        return res.status(404).json({ error: 'Scan not found', scanId: req.params.id });
    }
    res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🛡️  ${APP_NAME} v${VERSION} API Server`);
    console.log(`   Listening on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   Start scan: POST http://localhost:${PORT}/scan\n`);
});
