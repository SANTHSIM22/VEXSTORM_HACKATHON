const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class CryptoAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('CryptoAgent', 'A02 - Cryptographic Failures', logger, memory, findingsStore);
    }

    /**
     * Calculates confidence for cryptographic failure findings.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'httpProtocol' | 'noRedirect' | 'missingHSTS' | 'weakHSTS' | 'sensitiveParam'
     * @param {boolean} factors.isHttp - Target uses HTTP
     * @param {number}  factors.httpStatus - Response status code
     * @param {boolean} factors.hstsPresent - Whether HSTS header exists
     * @param {number}  factors.maxAge - HSTS max-age value in seconds
     * @param {boolean} factors.paramNameHighlySensitive - e.g., 'password', 'secret', 'token'
     * @param {boolean} factors.paramNameModerateSensitive - e.g., 'key', 'auth', 'session'
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType, isHttp = false, httpStatus = 0, hstsPresent = false, maxAge = 0, paramNameHighlySensitive = false, paramNameModerateSensitive = false }) {
        let score = 0;

        switch (vulnType) {
            case 'httpProtocol':
                score = 0.5;
                if (isHttp) score += 0.4;               // confirmed HTTP
                break;
            case 'noRedirect':
                score = 0.35;
                if (isHttp) score += 0.2;                // confirmed HTTP
                if (httpStatus >= 200 && httpStatus < 300) score += 0.2; // serves content over HTTP
                if (httpStatus >= 400) score += 0.1;     // errors but still no redirect
                break;
            case 'missingHSTS':
                score = 0.5;
                if (!hstsPresent) score += 0.35;         // completely absent
                break;
            case 'weakHSTS':
                score = 0.2;
                if (maxAge < 86400) score += 0.35;       // less than a day
                else if (maxAge < 2592000) score += 0.25; // less than 30 days
                else if (maxAge < 31536000) score += 0.15; // less than a year
                break;
            case 'sensitiveParam':
                score = 0.35;
                if (paramNameHighlySensitive) score += 0.4;
                else if (paramNameModerateSensitive) score += 0.25;
                break;
            default:
                score = 0.5;
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        const findings = [];
        const { URL } = require('url');
        const parsed = new URL(target);

        // Check if target uses HTTPS
        if (parsed.protocol === 'http:') {
            this.addFinding({
                type: 'Cryptographic Failure',
                endpoint: target,
                parameter: 'protocol',
                description: 'Application served over unencrypted HTTP',
                evidence: `Protocol: ${parsed.protocol}`,
                confidenceScore: this._calculateConfidence({ vulnType: 'httpProtocol', isHttp: true }),
                exploitScenario: 'All traffic including credentials can be intercepted via MITM attack',
                impact: 'Complete data interception, credential theft, session hijacking',
                reproductionSteps: [
                    `1. Open a browser and navigate to: ${target}`,
                    `2. Observe that the connection is not secure (uses HTTP instead of HTTPS).`,
                    `3. Alternatively, run: curl -I "${target}" and check the URL.`
                ],
            });
        }

        // Check for HTTPS redirect
        if (parsed.protocol === 'http:') {
            try {
                const response = await makeRequest(target, { maxRedirects: 0 });
                if (!(response.status >= 300 && response.status < 400)) {
                    this.addFinding({
                        type: 'Cryptographic Failure',
                        endpoint: target,
                        parameter: 'HTTPS redirect',
                        description: 'No automatic redirect from HTTP to HTTPS',
                        evidence: `HTTP request returns status ${response.status} instead of 301/302 redirect`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'noRedirect', isHttp: true, httpStatus: response.status }),
                        exploitScenario: 'Users accessing the site via HTTP remain on unencrypted connection',
                        impact: 'Data exposure in transit',
                        reproductionSteps: [
                            `1. Run: curl -I "http://${parsed.host}${parsed.pathname}"`,
                            `2. Observe that the HTTP status code is ${response.status}.`,
                            `3. It does not return a 301 or 302 redirect to an HTTPS URL.`
                        ],
                    });
                }
            } catch (_) { }
        }

        // Check for HSTS header
        try {
            const response = await makeRequest(target);
            const hsts = response.headers['strict-transport-security'];
            if (!hsts) {
                this.addFinding({
                    type: 'Cryptographic Failure',
                    endpoint: target,
                    parameter: 'HSTS',
                    description: 'Missing HTTP Strict Transport Security (HSTS) header',
                    evidence: 'No Strict-Transport-Security header in response',
                    confidenceScore: this._calculateConfidence({ vulnType: 'missingHSTS', hstsPresent: false }),
                    exploitScenario: 'Browser does not enforce HTTPS, enabling SSL stripping attacks',
                    impact: 'Vulnerability to SSL stripping and MITM attacks',
                    reproductionSteps: [
                        `1. Run: curl -s -I "${target}"`,
                        `2. Inspect the HTTP response headers.`,
                        `3. Verify that the "Strict-Transport-Security" header is completely missing.`
                    ],
                });
            } else {
                const maxAge = parseInt((hsts.match(/max-age=(\d+)/) || [])[1] || '0');
                if (maxAge < 31536000) {
                    this.addFinding({
                        type: 'Cryptographic Failure',
                        endpoint: target,
                        parameter: 'HSTS max-age',
                        description: `HSTS max-age is too low: ${maxAge} seconds`,
                        evidence: `Strict-Transport-Security: ${hsts}`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'weakHSTS', maxAge }),
                        exploitScenario: 'Short HSTS max-age allows periodic windows for SSL stripping',
                        impact: 'Reduced HSTS protection effectiveness',
                        reproductionSteps: [
                            `1. Run: curl -s -I "${target}"`,
                            `2. Inspect the HTTP response headers.`,
                            `3. Verify that the "Strict-Transport-Security" header has a max-age less than 31536000.`
                        ],
                    });
                }
            }

            // Check for sensitive data in URLs
            const { urls } = this.memory.attackSurface;
            for (const url of urls.slice(0, 20)) {
                try {
                    const urlObj = new URL(url);
                    for (const [key, value] of urlObj.searchParams) {
                        if (/password|secret|token|key|api_key|auth|session|credit|card|ssn/i.test(key)) {
                            this.addFinding({
                                type: 'Cryptographic Failure',
                                endpoint: url,
                                parameter: key,
                                description: `Sensitive data "${key}" exposed in URL parameter`,
                                evidence: `Parameter "${key}" found in URL query string`,
                                confidenceScore: this._calculateConfidence({ vulnType: 'sensitiveParam', paramNameHighlySensitive: /password|secret|ssn|credit|card/i.test(key), paramNameModerateSensitive: /token|key|api_key|auth|session/i.test(key) }),
                                exploitScenario: 'Sensitive data in URLs is logged in browser history, server logs, and proxy logs',
                                impact: 'Credential/token exposure via logs',
                                reproductionSteps: [
                                    `1. Note the exposed URL: ${url}`,
                                    `2. Look at the query parameter "${key}".`,
                                    `3. Observe that it contains sensitive token or password information in plaintext.`
                                ],
                            });
                        }
                    }
                } catch (_) { }
            }
        } catch (_) { }

        return findings;
    }
}

module.exports = CryptoAgent;
