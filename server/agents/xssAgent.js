const BaseAgent = require('./baseAgent');
const { timedRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { generatePayloads, chat, analyzeResponse } = require('../llm/mistralClient');
const { appendParam } = require('../utils/urlHelper');

const XSS_TIMEOUT = 10000;

class XSSAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('XSSAgent', 'A03 - Injection', logger, memory, findingsStore, registryRef);
        this.validator = new ValidationEngine(logger);
        this.goal = "Identify Reflected, Stored, and DOM-based XSS vulnerabilities by reasoning about input reflections and analyzing browser-side execution sinks.";
    }

    /**
     * Calculates confidence for XSS findings based on reflection quality and analysis signals.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'reflected' | 'dom'
     * @param {boolean} factors.isUnescaped - Payload reflected without encoding
     * @param {boolean} factors.isReflected - Payload reflected at all (possibly encoded)
     * @param {boolean} factors.llmSuspicious - LLM flagged response as suspicious
     * @param {boolean} factors.payloadContainsHtml - Payload contains < or > (HTML context)
     * @param {boolean} factors.hasSink - DOM sink found in page (e.g. innerHTML, document.write)
     * @param {boolean} factors.hasSource - DOM source found (e.g. location.hash, location.search)
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType = 'reflected', isUnescaped = false, isReflected = false, llmSuspicious = false, payloadContainsHtml = false, hasSink = false, hasSource = false }) {
        let score = 0;

        if (vulnType === 'reflected') {
            score = 0.15;
            if (isUnescaped) score += 0.4;                // definitive: unescaped HTML reflected
            else if (isReflected) score += 0.15;          // reflected but encoded
            if (llmSuspicious) score += 0.15;
            if (payloadContainsHtml) score += 0.1;        // payload had HTML chars, increasing relevance
        } else if (vulnType === 'dom') {
            score = 0.15;
            if (hasSink) score += 0.25;                   // dangerous sink present
            if (hasSource) score += 0.2;                  // user-controlled source present
            if (hasSink && hasSource) score += 0.1;       // both = higher confidence
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        this.logger.info(`[XSSAgent] Goal: ${this.goal}`);
        const findings = [];
        const { forms, parameters, urls, apiEndpoints } = this.memory.attackSurface;

        // 1. REASONING PHASE: Identify high-risk XSS vectors
        const surfaceData = {
            forms: forms.slice(0, 20).map(f => ({ action: f.action, inputs: f.inputs.map(i => i.name) })),
            params: parameters.slice(0, 50)
        };

        const reasoningPrompt = `Identify the top 15 input vectors most likely to be vulnerable to XSS (e.g., search bars, profile fields, comment sections).
        Return ONLY JSON array: [{"type": "form|param", "target": "...", "field": "...", "reasoning": "..."}]`;

        let targets = [];
        try {
            const raw = await chat("You are a security reasoning engine.", reasoningPrompt + "\n" + JSON.stringify(surfaceData));
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            targets = JSON.parse(cleaned);
        } catch (e) {
            this.logger.error(`[XSSAgent] Reasoning failed: ${e.message}`);
            // Fallback to basic heuristics (increased)
            targets = [
                ...parameters.slice(0, 15).map(p => ({ type: 'param', target: p.url, field: p.param, reasoning: 'Heuristic' })),
                ...forms.slice(0, 5).map(f => ({ type: 'form', target: f.action, field: f.inputs[0]?.name, reasoning: 'Heuristic' }))
            ].filter(t => t.field);
        }

        // 2. EXECUTION PHASE: Test identified vectors
        for (const t of targets) {
            this.logger.info(`[XSSAgent] Testing ${t.type} ${t.field} on ${t.target} (${t.reasoning})`);
            if (t.type === 'form') {
                const form = forms.find(f => f.action === t.target);
                if (form) {
                    const result = await this._testXSSAgentic(form.action, t.field, form.method);
                    findings.push(...result);
                }
            } else {
                const result = await this._testReflectedXSSAgentic(t.target, t.field);
                findings.push(...result);
            }
        }

        // 3. DOM XSS CHECK
        for (const url of urls.slice(0, 10)) {
            try {
                const res = await timedRequest(url, { timeout: XSS_TIMEOUT });
                const domXssResult = this._checkDOMXSS(url, res.data);
                if (domXssResult) {
                    this.addFinding(domXssResult);
                    findings.push({ type: 'DOM XSS', endpoint: url });
                }
            } catch (_) { }
        }

        return findings;
    }

    async _testXSSAgentic(url, inputName, method) {
        const findings = [];
        const payloads = await generatePayloads({
            vulnType: 'XSS',
            targetContext: `Field: ${inputName} at ${url}`,
            inputField: inputName,
            count: 3
        });

        for (const payload of payloads) {
            try {
                const data = method === 'POST' ? { [inputName]: payload } : undefined;
                const params = method === 'GET' ? { [inputName]: payload } : undefined;
                const response = await timedRequest(url, { method, data, params, timeout: XSS_TIMEOUT });

                // VERIFICATION: LLM Analysis
                const analysis = await analyzeResponse({
                    vulnType: 'XSS',
                    status: response.status,
                    body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                    payload
                });

                if (analysis.suspicious || this.validator.detectReflection(payload, response.data).reflected) {
                    const isUnescaped = this._isUnescapedReflection(payload, response.data);
                    const isReflected = this.validator.detectReflection(payload, response.data).reflected;
                    this.addFinding({
                        type: isUnescaped ? 'Reflected XSS' : 'XSS',
                        endpoint: url,
                        parameter: inputName,
                        description: `XSS detected: ${analysis.reasoning || 'Payload reflected in response'}`,
                        evidence: `Payload: ${payload}. LLM Status: ${analysis.suspicious}. Unescaped: ${isUnescaped}`,
                        payload,
                        confidenceScore: this._calculateConfidence({ vulnType: 'reflected', isUnescaped, isReflected, llmSuspicious: !!analysis.suspicious, payloadContainsHtml: /[<>]/.test(payload) }),
                        exploitScenario: `User input in "${inputName}" is reflected uncurated, allowing script execution.`,
                        impact: 'Session theft, phishing, DOM manipulation',
                        reproductionSteps: [
                            `1. Navigate to ${url}`,
                            `2. Submit ${payload} into ${inputName}`,
                            `3. Observe the reflection in the page source.`
                        ]
                    });
                    findings.push({ type: 'XSS', endpoint: url });
                    if (isUnescaped) break;
                }
            } catch (_) { }
        }
        return findings;
    }

    async _testReflectedXSSAgentic(url, paramName) {
        // Similar to _testXSSAgentic but via URL appending
        return await this._testXSSAgentic(url, paramName, 'GET');
    }

    _isUnescapedReflection(payload, body) {
        if (typeof body !== 'string') return false;
        return body.includes(payload) && /[<>]/.test(payload);
    }

    _checkDOMXSS(url, body) {
        if (typeof body !== 'string') return null;
        const sinks = [/innerHTML/i, /document\.write/i, /eval\(/i];
        const sources = [/location\.hash/i, /location\.search/i];

        let foundSink = sinks.find(s => s.test(body));
        let foundSource = sources.find(s => s.test(body));

        if (foundSink && foundSource) {
            return {
                type: 'DOM-based XSS',
                endpoint: url,
                parameter: 'DOM',
                description: `Potential DOM XSS via source ${foundSource} and sink ${foundSink}`,
                evidence: `Source: ${foundSource}, Sink: ${foundSink} detected in client-side JS.`,
                confidenceScore: this._calculateConfidence({ vulnType: 'dom', hasSink: !!foundSink, hasSource: !!foundSource }),
                exploitScenario: 'Attacker provides malicious string in hash/query that reaches an unsafe DOM sink.',
                impact: 'Client-side code execution',
                reproductionSteps: [
                    `1. Open ${url}`,
                    `2. Identify the script using ${foundSource}`,
                    `3. Attempt to provide a payload like "#<img src=x onerror=alert(1)>"`
                ]
            };
        }
        return null;
    }
}

module.exports = XSSAgent;
