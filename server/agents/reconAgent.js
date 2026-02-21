const BaseAgent = require('./baseAgent');
const Crawler = require('../tools/crawler');
const FormAnalyzer = require('../tools/formAnalyzer');
const { makeRequest } = require('../utils/httpClient');
const { MAX_DEPTH } = require('../config');

class ReconAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('ReconAgent', 'Reconnaissance', logger, memory, findingsStore);
    }

    /**
     * Calculates confidence for reconnaissance findings based on path sensitivity and response signals.
     * @param {object} factors
     * @param {string}  factors.path - The discovered sensitive path
     * @param {boolean} factors.statusIs200 - HTTP 200 response
     * @param {number}  factors.contentLength - Response body length
     * @param {boolean} factors.isHighSensitivity - Path is highly sensitive (e.g. .env, .git/HEAD)
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ path = '', statusIs200 = false, contentLength = 0, isHighSensitivity = false }) {
        let score = 0.2; // base

        // Path sensitivity
        if (isHighSensitivity) score += 0.35;            // .env, .git/HEAD are critical
        else score += 0.15;                              // admin, debug, status

        // Response quality
        if (statusIs200) score += 0.15;
        if (contentLength > 200) score += 0.15;          // substantial content confirms it's real
        else if (contentLength > 50) score += 0.1;

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        this.logger.info(`[ReconAgent] Starting reconnaissance on ${target}`);

        const crawler = new Crawler(this.logger, MAX_DEPTH);
        const crawlResults = await crawler.crawl(target);

        this.logger.info(`[ReconAgent] Crawled ${crawlResults.urls.length} URLs, ${crawlResults.forms.length} forms, ${crawlResults.parameters.length} params`);

        const formAnalyzer = new FormAnalyzer();
        for (const url of crawlResults.urls.slice(0, 15)) {
            try {
                const response = await makeRequest(url);
                if (typeof response.data === 'string') {
                    const forms = formAnalyzer.analyze(response.data, url);
                    for (const form of forms) form.sourceUrl = url;
                }
            } catch (_) { }
        }

        const commonPaths = [
            '/robots.txt', '/sitemap.xml', '/.env', '/admin', '/login',
            '/api', '/.git/HEAD', '/swagger.json',
        ];

        const { URL } = require('url');
        const baseOrigin = new URL(target).origin;

        for (const path of commonPaths) {
            try {
                const response = await makeRequest(`${baseOrigin}${path}`, { retries: 1, timeout: 5000 });
                if (response.status === 200) {
                    this.logger.info(`[ReconAgent] Discovered: ${path} (status: ${response.status})`);
                    crawlResults.urls.push(`${baseOrigin}${path}`);

                    if (['/admin', '/debug', '/status', '/.env', '/.git/HEAD'].includes(path)) {
                        const respBody = typeof response.data === 'string' ? response.data : '';
                        this.addFinding({
                            type: 'Information Disclosure',
                            endpoint: `${baseOrigin}${path}`,
                            parameter: 'N/A',
                            description: `Sensitive path ${path} is accessible (HTTP 200)`,
                            evidence: `Status: ${response.status}`,
                            confidenceScore: this._calculateConfidence({ path, statusIs200: true, contentLength: respBody.length, isHighSensitivity: ['/.env', '/.git/HEAD'].includes(path) }),
                            exploitScenario: `An attacker can access ${path} to gather sensitive information about the application`,
                            impact: 'Information disclosure may lead to further attacks',
                            reproductionSteps: [
                                `1. Open in browser: ${baseOrigin}${path}`,
                                `2. Or run: curl ${baseOrigin}${path}`,
                                `3. Observe: the page returns HTTP 200 with sensitive content`,
                                `4. This path should be restricted or removed from production`,
                            ],
                        });
                    }
                }
            } catch (_) { }
        }

        this.memory.updateAttackSurface(crawlResults);
        return [];
    }
}

module.exports = ReconAgent;
