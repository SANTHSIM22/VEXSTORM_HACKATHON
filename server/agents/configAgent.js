const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const HeaderAnalyzer = require('../tools/headerAnalyzer');

class ConfigAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('ConfigAgent', 'A05 - Security Misconfiguration', logger, memory, findingsStore);
    }

    /**
     * Calculates confidence for security misconfiguration findings.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'missingHeader' | 'infoLeak' | 'cors' | 'cookie' | 'debug' | 'httpMethods'
     * @param {boolean} factors.headerAbsent - Whether a security header is completely absent
     * @param {boolean} factors.isCriticalHeader - Whether the header is critical (CSP, X-Frame-Options, etc.)
     * @param {boolean} factors.revealsTechnology - Whether the leak reveals exact technology/version
     * @param {boolean} factors.isWildcardOrigin - CORS allows wildcard '*'
     * @param {boolean} factors.reflectsArbitraryOrigin - CORS reflects arbitrary origin
     * @param {number}  factors.contentLength - Response body length
     * @param {boolean} factors.statusIs200 - HTTP 200 response
     * @param {number}  factors.dangerousMethodCount - Number of dangerous HTTP methods enabled
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType, headerAbsent = false, isCriticalHeader = false, revealsTechnology = false, isWildcardOrigin = false, reflectsArbitraryOrigin = false, contentLength = 0, statusIs200 = false, dangerousMethodCount = 0 }) {
        let score = 0;

        switch (vulnType) {
            case 'missingHeader':
                score = 0.5;
                if (headerAbsent) score += 0.2;
                if (isCriticalHeader) score += 0.25;
                break;
            case 'infoLeak':
                score = 0.5;
                if (revealsTechnology) score += 0.35;
                break;
            case 'cors':
                score = 0.4;
                if (isWildcardOrigin) score += 0.3;
                if (reflectsArbitraryOrigin) score += 0.25;
                break;
            case 'cookie':
                score = 0.5;
                if (isCriticalHeader) score += 0.3; // reusing for 'is session cookie'
                break;
            case 'debug':
                score = 0.3;
                if (statusIs200) score += 0.2;
                if (contentLength > 200) score += 0.15;
                else if (contentLength > 50) score += 0.1;
                break;
            case 'httpMethods':
                score = 0.3;
                score += Math.min(dangerousMethodCount * 0.12, 0.48);
                break;
            default:
                score = 0.5;
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        const findings = [];
        const headerAnalyzer = new HeaderAnalyzer();

        // Phase 1: Analyze security headers
        try {
            const response = await makeRequest(target);
            const analysis = headerAnalyzer.analyze(response.headers);

            for (const missing of analysis.missing) {
                const criticalHeaders = ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security'];
                this.addFinding({
                    type: 'Missing Security Header',
                    endpoint: target,
                    parameter: missing.header,
                    description: `Missing security header: ${missing.name} (${missing.description})`,
                    evidence: `Header "${missing.header}" not present in response`,
                    confidenceScore: this._calculateConfidence({ vulnType: 'missingHeader', headerAbsent: true, isCriticalHeader: criticalHeaders.includes(missing.header.toLowerCase()) }),
                    exploitScenario: missing.recommendation,
                    impact: `Lack of ${missing.name} protection`,
                    reproductionSteps: [
                        `1. Run: curl -I ${target}`,
                        `2. Inspect the response headers`,
                        `3. Observe: "${missing.header}" header is missing from the response`,
                        `4. Recommendation: ${missing.recommendation}`,
                    ],
                });
            }

            for (const leak of analysis.informationLeaks) {
                this.addFinding({
                    type: 'Information Disclosure',
                    endpoint: target,
                    parameter: leak.header,
                    description: `Server information disclosure via ${leak.header} header`,
                    evidence: `${leak.header}: ${leak.value}`,
                    confidenceScore: this._calculateConfidence({ vulnType: 'infoLeak', revealsTechnology: /\d+\.\d+/.test(leak.value) }),
                    exploitScenario: 'Attackers can fingerprint the server technology to find known vulnerabilities',
                    impact: 'Facilitates targeted attacks',
                    reproductionSteps: [
                        `1. Run: curl -I ${target}`,
                        `2. Find the header: ${leak.header}: ${leak.value}`,
                        `3. This reveals server technology details useful for targeted attacks`,
                    ],
                });
            }

            for (const cors of analysis.corsIssues) {
                this.addFinding({
                    type: 'CORS Misconfiguration',
                    endpoint: target,
                    parameter: 'CORS',
                    description: cors.issue,
                    evidence: cors.value,
                    confidenceScore: this._calculateConfidence({ vulnType: 'cors', isWildcardOrigin: (cors.value || '').includes('*'), reflectsArbitraryOrigin: /reflects/i.test(cors.issue) }),
                    exploitScenario: 'Attacker website can make authenticated requests to this application',
                    impact: 'Data theft, unauthorized actions',
                    reproductionSteps: [
                        `1. Run: curl -I ${target}`,
                        `2. Inspect CORS-related headers`,
                        `3. Issue: ${cors.issue}`,
                        `4. Value: ${cors.value}`,
                    ],
                });
            }

            for (const cookie of analysis.cookieIssues) {
                this.addFinding({
                    type: 'Security Misconfiguration',
                    endpoint: target,
                    parameter: cookie.cookie,
                    description: `Cookie "${cookie.cookie}": ${cookie.issue}`,
                    evidence: cookie.issue,
                    confidenceScore: this._calculateConfidence({ vulnType: 'cookie', isCriticalHeader: /session|sess|sid|auth|token/i.test(cookie.cookie) }),
                    exploitScenario: 'Insecure cookie settings enable session attacks',
                    impact: 'Session hijacking, CSRF',
                    reproductionSteps: [
                        `1. Open DevTools > Application > Cookies on: ${target}`,
                        `2. Find cookie: "${cookie.cookie}"`,
                        `3. Issue: ${cookie.issue}`,
                    ],
                });
            }
        } catch (err) {
            this.logger.warn(`[ConfigAgent] Header analysis failed: ${err.message}`);
        }

        // Phase 2: Debug endpoints
        const { URL } = require('url');
        const baseOrigin = new URL(target).origin;
        const debugPaths = ['/debug', '/trace', '/actuator', '/phpinfo.php', '/server-status', '/console', '/shell', '/admin/config'];

        for (const path of debugPaths) {
            try {
                const response = await makeRequest(`${baseOrigin}${path}`, { retries: 1, timeout: 5000 });
                if (response.status === 200) {
                    const debugBody = typeof response.data === 'string' ? response.data : '';
                    this.addFinding({
                        type: 'Debug Endpoint',
                        endpoint: `${baseOrigin}${path}`,
                        parameter: 'N/A',
                        description: `Debug/admin endpoint accessible: ${path}`,
                        evidence: `HTTP 200 on ${path}`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'debug', statusIs200: true, contentLength: debugBody.length }),
                        exploitScenario: `Attacker accesses ${path} to gather internal information`,
                        impact: 'Information disclosure, potential remote code execution',
                        reproductionSteps: [
                            `1. Open in browser: ${baseOrigin}${path}`,
                            `2. Or run: curl ${baseOrigin}${path}`,
                            `3. Observe: the endpoint responds with HTTP 200 and exposes internal information`,
                        ],
                    });
                }
            } catch (_) { }
        }

        // Phase 3: CORS testing with evil origin
        try {
            const response = await makeRequest(target, {
                headers: { 'Origin': 'https://evil-attacker.com' },
                // No explicit timeout, use default
            });
            const allowOrigin = response.headers['access-control-allow-origin'];
            if (allowOrigin === 'https://evil-attacker.com' || allowOrigin === '*') {
                this.addFinding({
                    type: 'CORS Misconfiguration',
                    endpoint: target,
                    parameter: 'Access-Control-Allow-Origin',
                    description: 'CORS policy reflects arbitrary origin or uses wildcard',
                    evidence: `Access-Control-Allow-Origin: ${allowOrigin} for Origin: https://evil-attacker.com`,
                    confidenceScore: this._calculateConfidence({ vulnType: 'cors', isWildcardOrigin: allowOrigin === '*', reflectsArbitraryOrigin: allowOrigin === 'https://evil-attacker.com' }),
                    exploitScenario: 'Any website can make cross-origin requests to this application',
                    impact: 'Data theft via cross-origin requests',
                    reproductionSteps: [
                        `1. Run: curl -H "Origin: https://evil-attacker.com" -I ${target}`,
                        `2. Observe response header: Access-Control-Allow-Origin: ${allowOrigin}`,
                        `3. The server accepts requests from any origin`,
                    ],
                });
            }
        } catch (_) { }

        // Phase 4: HTTP methods
        try {
            const response = await makeRequest(target, { method: 'OPTIONS', timeout: 5000 });
            const allow = response.headers['allow'] || '';
            const dangerousMethods = ['PUT', 'DELETE', 'TRACE', 'CONNECT'];
            const enabled = dangerousMethods.filter(m => allow.toUpperCase().includes(m));
            if (enabled.length > 0) {
                this.addFinding({
                    type: 'Security Misconfiguration',
                    endpoint: target,
                    parameter: 'HTTP Methods',
                    description: `Potentially dangerous HTTP methods enabled: ${enabled.join(', ')}`,
                    evidence: `Allow: ${allow}`,
                    confidenceScore: this._calculateConfidence({ vulnType: 'httpMethods', dangerousMethodCount: enabled.length }),
                    exploitScenario: 'Dangerous HTTP methods can be used to modify or delete resources',
                    impact: 'Unauthorized data modification',
                    reproductionSteps: [
                        `1. Run: curl -X OPTIONS -I ${target}`,
                        `2. Observe Allow header: ${allow}`,
                        `3. Dangerous methods enabled: ${enabled.join(', ')}`,
                    ],
                });
            }
        } catch (_) { }

        return findings;
    }
}

module.exports = ConfigAgent;
