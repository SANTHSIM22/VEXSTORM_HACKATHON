const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class LoggingAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('LoggingAgent', 'A09 - Logging & Monitoring Failures', logger, memory, findingsStore);
    }

    /**
     * Calculates confidence for logging/monitoring failure findings.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'verboseError' | 'logFile' | 'noRateLimit'
     * @param {number}  factors.patternsMatched - Number of verbose error patterns matched
     * @param {number}  factors.contentLength - Response body length
     * @param {boolean} factors.containsStackTrace - Stack trace pattern detected
     * @param {boolean} factors.containsFilePaths - Internal file paths visible
     * @param {boolean} factors.statusIs200 - HTTP 200 response
     * @param {number}  factors.successfulRequests - Number of requests that succeeded without rate limiting
     * @param {number}  factors.totalRequests - Total requests sent
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType, patternsMatched = 0, contentLength = 0, containsStackTrace = false, containsFilePaths = false, statusIs200 = false, successfulRequests = 0, totalRequests = 0 }) {
        let score = 0;

        switch (vulnType) {
            case 'verboseError':
                score = 0.3;
                if (containsStackTrace) score += 0.3;       // definitive stack trace
                if (containsFilePaths) score += 0.15;       // internal paths exposed
                score += Math.min(patternsMatched * 0.1, 0.25); // more patterns = more confidence
                break;
            case 'logFile':
                score = 0.2;
                if (statusIs200) score += 0.15;
                if (contentLength > 500) score += 0.25;     // substantial log content
                else if (contentLength > 200) score += 0.15;
                else if (contentLength > 50) score += 0.1;
                break;
            case 'noRateLimit':
                score = 0.15;
                if (totalRequests > 0) {
                    const successRate = successfulRequests / totalRequests;
                    score += successRate * 0.3;              // all succeeded = +0.3
                }
                break;
            default:
                score = 0.5;
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        const findings = [];
        const { URL } = require('url');
        const baseOrigin = new URL(target).origin;

        // Check for verbose error messages
        const errorTriggers = [
            { path: '/nonexistent-page-404-test', description: '404 error page' },
            { path: "/%00", description: 'null byte' },
            { path: '/../../../../etc/passwd', description: 'path traversal' },
            { path: "/?id='", description: 'SQL syntax error' },
            { path: '/api/v1/test', method: 'POST', data: '{invalid-json}', description: 'malformed JSON' },
            { path: '/api/v1/test', method: 'POST', data: { a: 'A'.repeat(5000) }, description: 'long string payload' },
            { path: '/web3-sandbox', description: 'sandbox endpoint' }
        ];

        for (const trigger of errorTriggers) {
            try {
                const response = await makeRequest(`${baseOrigin}${trigger.path}`, {
                    method: trigger.method || 'GET',
                    data: trigger.data,
                    retries: 1,
                    timeout: 5000
                });
                const body = typeof response.data === 'string' ? response.data : '';

                // Check for stack traces or detailed error info
                const verbosePatterns = [
                    /stack\s*trace/i, /exception/i, /debug\s*mode/i,
                    /at\s+\w+\s+\(.*:\d+:\d+\)/,
                    /File\s+"[^"]+",\s+line\s+\d+/,
                    /Warning:.*on line \d+/i,
                    /PHP\s+(Notice|Warning|Fatal|Parse)/i,
                    /Traceback\s+\(most recent/i,
                ];

                const matched = verbosePatterns.filter(p => p.test(body));
                if (matched.length > 0) {
                    const snippet = body.length > 200 ? body.substring(0, 200).replace(/\n/g, ' ') : body;
                    const hasStackTrace = /at\s+\w+\s+\(.*:\d+:\d+\)|Traceback\s+\(most recent/i.test(body);
                    const hasFilePaths = /File\s+"[^"]+",\s+line\s+\d+|Warning:.*on line \d+/i.test(body);
                    this.addFinding({
                        type: 'Logging Failure',
                        endpoint: `${baseOrigin}${trigger.path}`,
                        parameter: trigger.description,
                        description: `Verbose error information disclosed on ${trigger.description}`,
                        evidence: `Pattern Matched. Response Snippet: ${snippet}...`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'verboseError', patternsMatched: matched.length, containsStackTrace: hasStackTrace, containsFilePaths: hasFilePaths }),
                        exploitScenario: 'Detailed error messages reveal internal paths, technology stack, and code structure',
                        impact: 'Information disclosure aids attacker reconnaissance',
                        reproductionSteps: [
                            `1. Run: curl -s "${baseOrigin}${trigger.path}"`,
                            `2. Observe the verbose error message or stack trace in the response body.`
                        ],
                    });
                }
            } catch (_) { }
        }

        // Check for accessible log files
        const logPaths = [
            '/logs', '/log', '/error.log', '/debug.log', '/app.log',
            '/access.log', '/storage/logs/laravel.log', '/logs/error.log',
            '/npm-debug.log', '/yarn-error.log', '/.logs', '/.log'
        ];

        for (const path of logPaths) {
            try {
                const response = await makeRequest(`${baseOrigin}${path}`, { retries: 1, timeout: 5000 });
                if (response.status === 200) {
                    const body = typeof response.data === 'string' ? response.data : '';
                    if (body.length > 50) {
                        this.addFinding({
                            type: 'Logging Failure',
                            endpoint: `${baseOrigin}${path}`,
                            parameter: 'N/A',
                            description: `Potential log file accessible at ${path}`,
                            evidence: `HTTP 200 with ${body.length} bytes of content`,
                            confidenceScore: this._calculateConfidence({ vulnType: 'logFile', statusIs200: true, contentLength: body.length }),
                            exploitScenario: `Attacker reads ${path} to discover internal errors, user data, and system info`,
                            impact: 'Sensitive data exposure via logs',
                            reproductionSteps: [
                                `1. Open a browser or run: curl -s "${baseOrigin}${path}"`,
                                `2. Observe the HTTP 200 response and plaintext logs being exposed.`
                            ],
                        });
                    }
                }
            } catch (_) { }
        }

        // Check for missing security logging (rate limiting)
        try {
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(makeRequest(`${baseOrigin}/nonexistent-${Date.now()}-${i}`, { retries: 1, timeout: 5000 }));
            }
            const responses = await Promise.allSettled(requests);
            const allSucceeded = responses.every(r => r.status === 'fulfilled' && r.value.status < 429);

            if (allSucceeded) {
                const succeededCount = responses.filter(r => r.status === 'fulfilled' && r.value.status < 429).length;
                this.addFinding({
                    type: 'Logging Failure',
                    endpoint: target,
                    parameter: 'Rate Limiting',
                    description: 'No rate limiting detected on rapid requests',
                    evidence: '5 rapid requests all returned non-429 responses',
                    confidenceScore: this._calculateConfidence({ vulnType: 'noRateLimit', successfulRequests: succeededCount, totalRequests: responses.length }),
                    exploitScenario: 'Attacker can brute-force endpoints without being rate-limited or detected',
                    impact: 'Enables brute force, enumeration, and DoS attacks',
                    reproductionSteps: [
                        `1. Use an automated script or Burp Suite Intruder.`,
                        `2. Send 5-10 rapid consecutive requests to ${target}/nonexistent-xyz.`,
                        `3. Observe that none of the responses return HTTP 429 Too Many Requests.`
                    ],
                });
            }
        } catch (_) { }

        return findings;
    }
}

module.exports = LoggingAgent;
