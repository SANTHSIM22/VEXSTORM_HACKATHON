require('dotenv').config();

const APP_NAME = 'VulnSight-AI';
const VERSION = '3.0.0';

const config = {
    APP_NAME,
    VERSION,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
    SCAN_TIMEOUT: parseInt(process.env.SCAN_TIMEOUT, 10) || 15000,
    MAX_DEPTH: parseInt(process.env.MAX_DEPTH, 10) || 3,
    RATE_LIMIT: parseInt(process.env.RATE_LIMIT, 10) || 10,
    SAFE_MODE: process.env.SAFE_MODE !== 'false',
};

function validateConfig() {
    if (!config.MISTRAL_API_KEY) {
        console.error('[FATAL] MISTRAL_API_KEY is not set in .env file. Exiting.');
        process.exit(1);
    }
}

module.exports = { ...config, validateConfig };
