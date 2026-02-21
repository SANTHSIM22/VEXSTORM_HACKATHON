const BaseAgent = require('./baseAgent');
const Crawler = require('../tools/crawler');
const FormAnalyzer = require('../tools/formAnalyzer');
const { makeRequest } = require('../utils/httpClient');
const { MAX_DEPTH } = require('../config');

class ReconAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('ReconAgent', 'Reconnaissance', logger, memory, findingsStore);
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
                        this.addFinding({
                            type: 'Information Disclosure',
                            endpoint: `${baseOrigin}${path}`,
                            parameter: 'N/A',
                            description: `Sensitive path ${path} is accessible (HTTP 200)`,
                            evidence: `Status: ${response.status}`,
                            confidenceScore: 0.8,
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
