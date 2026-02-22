const axios = require('axios');
const RateLimiter = require('./rateLimiter');
const { SCAN_TIMEOUT, RATE_LIMIT } = require('../config');

const limiter = new RateLimiter(RATE_LIMIT, 1000);

async function makeRequest(url, options = {}) {
    await limiter.acquire();

    const config = {
        url,
        method: options.method || 'GET',
        timeout: options.timeout || SCAN_TIMEOUT,
        headers: {
            'User-Agent': 'VulnSight-AI/3.0 Security Scanner',
            ...options.headers,
        },
        data: options.data || undefined,
        params: options.params || undefined,
        maxRedirects: options.maxRedirects !== undefined ? options.maxRedirects : 5,
        validateStatus: () => true,
    };

    let lastError;
    const maxRetries = options.retries || 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios(config);
            return {
                status: response.status,
                headers: response.headers,
                data: response.data,
                url: response.config.url,
                finalUrl: response.request?.res?.responseUrl || response.request?.responseURL || response.config.url,
                timingMs: 0,
            };
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }

    throw lastError;
}

async function timedRequest(url, options = {}) {
    const start = Date.now();
    const result = await makeRequest(url, options);
    result.timingMs = Date.now() - start;
    return result;
}

module.exports = { makeRequest, timedRequest };
