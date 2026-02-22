const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { chat, analyzeResponse } = require('../llm/mistralClient');

class BusinessLogicAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('BusinessLogicAgent', 'A04 - Insecure Design', logger, memory, findingsStore, registryRef);
        this.validator = new ValidationEngine(logger);
        this.goal = "Identify and exploit business logic flaws such as price manipulation, quantity bypass, and discount logic errors by reasoning about the application's transactional flows.";
    }

    /**
     * Calculates confidence for business logic findings based on server behavior and LLM analysis.
     * @param {object} factors
     * @param {number}  factors.llmConfidence - Confidence value from LLM analysis (0-1)
     * @param {boolean} factors.llmSuspicious - Whether LLM flagged the response as suspicious
     * @param {boolean} factors.serverAccepted - Server responded without error (status < 400 or 200)
     * @param {number}  factors.httpStatus - HTTP response status code
     * @param {boolean} factors.payloadIsNegative - Whether the payload contained a negative value
     * @param {boolean} factors.payloadIsZero - Whether the payload was zero
     * @param {string}  factors.context - 'form' | 'api'
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ llmConfidence = 0, llmSuspicious = false, serverAccepted = false, httpStatus = 0, payloadIsNegative = false, payloadIsZero = false, context = 'form' }) {
        let score = 0.15; // base

        // LLM analysis contribution (up to 0.35)
        if (llmConfidence > 0) score += Math.min(llmConfidence * 0.35, 0.35);
        if (llmSuspicious) score += 0.15;

        // Server behavior
        if (serverAccepted) score += 0.1;
        if (httpStatus === 200) score += 0.05;

        // Payload severity – negative values are more alarming than zero
        if (payloadIsNegative) score += 0.1;
        else if (payloadIsZero) score += 0.05;

        // API-level flaws are slightly less certain without UI context
        if (context === 'api') score -= 0.05;

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        this.logger.info(`[BusinessLogicAgent] Goal: ${this.goal}`);
        const findings = [];
        const { forms, apiEndpoints } = this.memory.attackSurface;

        // 1. REASONING PHASE: Identify suspicious business flows
        const surfaceData = {
            forms: forms.map(f => ({ action: f.action, inputs: f.inputs.map(i => i.name) })),
            apis: (apiEndpoints || []).slice(0, 20)
        };

        const analysisPrompt = `Analyze this attack surface for potential business logic vulnerabilities (e.g., cart flaws, price manipulation, discount bypass).
Identify the top 5 most suspicious endpoints and explain why.
Return ONLY JSON array: [{"endpoint": "...", "reasoning": "...", "type": "price|quantity|discount"}]`;

        let suspiciousPaths = [];
        try {
            const raw = await chat("You are a business logic analyzer.", analysisPrompt + "\n" + JSON.stringify(surfaceData));
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            suspiciousPaths = JSON.parse(cleaned);
        } catch (e) {
            this.logger.error(`[BusinessLogicAgent] Reasoning failed: ${e.message}`);
            suspiciousPaths = forms.filter(f => f.inputs.some(i => /price|qty|amount/i.test(i.name)))
                .map(f => ({ endpoint: f.action, type: 'price', reasoning: 'Heuristic fallback' }));
        }

        // 2. EXECUTION: Test identified paths
        for (const path of suspiciousPaths) {
            this.logger.info(`[BusinessLogicAgent] Testing: ${path.endpoint} (${path.reasoning})`);
            const form = forms.find(f => f.action.includes(path.endpoint));
            const api = (apiEndpoints || []).find(a => a.includes(path.endpoint));

            if (form) {
                const results = await this._testFormLogic(form, path.type);
                findings.push(...results);
            } else if (api) {
                const results = await this._testApiLogic(api, path.type);
                findings.push(...results);
            }
        }

        return findings;
    }

    async _testFormLogic(form, type) {
        const findings = [];
        const inputName = form.inputs.find(i => /price|amount|qty|quantity|count|total|discount|credit|balance|points|rate/i.test(i.name))?.name || form.inputs[0]?.name;

        if (!inputName) return findings;

        // Ask LLM to generate context-appropriate payloads for this specific form field
        let payloads = [];
        try {
            const payloadPrompt = `You are testing a web form for business logic flaws.
The form action is: ${form.action}
The field being tested is: "${inputName}"
The suspected flaw type is: ${type}

Generate 3 test payloads that could exploit business logic in this field.
Consider what this field likely represents based on its name and the endpoint.
For numeric fields: try zero, negative, or extremely large values.
For text fields: try empty, special boundary values, or role escalation values.

Return ONLY a JSON array of payload strings, e.g.: ["0", "-1", "99999999"]`;
            const raw = await chat("You are a business logic testing expert.", payloadPrompt);
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            payloads = JSON.parse(cleaned);
            if (!Array.isArray(payloads) || payloads.length === 0) throw new Error('invalid');
        } catch (_) {
            // Fallback: generic boundary payloads
            payloads = ['0', '-1', '99999999'];
        }

        for (const payload of payloads) {
            try {
                const data = form.method === 'POST' ? { [inputName]: payload } : undefined;
                const params = form.method === 'GET' ? { [inputName]: payload } : undefined;
                const response = await makeRequest(form.action, { method: form.method, data, params, retries: 0 });

                // Only analyze if the server actually processed the request (2xx/3xx).
                // 4xx/5xx means the server properly rejected it — not a vulnerability.
                if (response.status >= 400) continue;

                const analysis = await analyzeResponse({
                    vulnType: 'Business Logic Flaw',
                    status: response.status,
                    body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                    payload
                });

                if (analysis.suspicious) {
                    this.addFinding({
                        type: 'Insecure Design',
                        endpoint: form.action,
                        parameter: inputName,
                        description: `Business logic flaw: ${type} manipulation. ${analysis.reasoning}`,
                        evidence: `Server accepted value "${payload}" with status ${response.status}. LLM confidence: ${analysis.confidence}`,
                        payload,
                        confidenceScore: this._calculateConfidence({ llmConfidence: analysis.confidence || 0, llmSuspicious: !!analysis.suspicious, serverAccepted: true, httpStatus: response.status, payloadIsNegative: String(payload).startsWith('-'), payloadIsZero: String(payload) === '0', context: 'form' }),
                        exploitScenario: `Manipulating ${type} allows bypassing business rules.`,
                        impact: 'Financial loss, data corruption',
                        reproductionSteps: [
                            `1. Go to ${form.action}`,
                            `2. Submit "${payload}" to "${inputName}"`,
                            `3. Observe behavior.`
                        ]
                    });
                    findings.push({ type: 'Logic Flaw', endpoint: form.action });
                    break;
                }
            } catch (_) { }
        }
        return findings;
    }

    async _testApiLogic(api, type) {
        const findings = [];

        // Ask LLM to generate context-appropriate payloads for this API endpoint
        let payloads = [];
        try {
            const payloadPrompt = `You are testing an API endpoint for business logic vulnerabilities.
Endpoint: ${api}

Based on the endpoint URL, determine what this API likely does and generate 3 different
JSON body payloads that could expose business logic flaws.

Rules:
- Infer the purpose of the endpoint from its URL path (e.g., /cart, /order, /transfer, /profile, /settings)
- Generate payloads with field names that make sense for that endpoint
- Test boundary conditions: zero values, negative values, extreme values, type confusion
- Do NOT always use "price" — use fields appropriate to the endpoint's purpose
- For auth endpoints: test role escalation (e.g., {"role":"admin"})
- For user endpoints: test IDOR or privilege fields
- For payment endpoints: test amount manipulation

Return ONLY a JSON array of objects, e.g.:
[{"amount": 0}, {"role": "admin"}, {"quantity": -1}]`;

            const raw = await chat("You are a business logic testing expert.", payloadPrompt);
            const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            payloads = JSON.parse(cleaned);
            if (!Array.isArray(payloads) || payloads.length === 0) throw new Error('invalid');
        } catch (_) {
            // Fallback: try a few generic boundary payloads based on the type hint from the reasoning phase
            const typePayloads = {
                price:    [{ price: 0 }, { price: -1 }, { amount: 0 }],
                quantity: [{ quantity: -1 }, { quantity: 0 }, { count: 99999999 }],
                discount: [{ discount: 100 }, { discount: -1 }, { coupon: 'FREEALL' }],
            };
            payloads = typePayloads[type] || [{ value: 0 }, { value: -1 }];
        }

        for (const payload of payloads) {
            try {
                const res = await makeRequest(api, { method: 'POST', data: payload, retries: 0 });

                // Only consider it a finding if the server actually accepted the request.
                // 4xx/5xx responses mean the server properly rejected it — NOT a vulnerability.
                if (res.status >= 400) continue;

                const payloadStr = JSON.stringify(payload);
                const analysis = await analyzeResponse({
                    vulnType: 'Business Logic Flaw',
                    status: res.status,
                    body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
                    payload: payloadStr
                });

                if (analysis.suspicious) {
                    this.addFinding({
                        type: 'Business Logic Flaw',
                        endpoint: api,
                        parameter: 'JSON Body',
                        description: `API logic manipulation: ${analysis.reasoning}`,
                        evidence: `Server accepted ${payloadStr} with status ${res.status}`,
                        payload: payloadStr,
                        confidenceScore: this._calculateConfidence({ llmConfidence: analysis.confidence || 0, llmSuspicious: !!analysis.suspicious, serverAccepted: true, httpStatus: res.status, payloadIsNegative: payloadStr.includes('-'), payloadIsZero: /:\s*0[,}]/.test(payloadStr), context: 'api' }),
                        exploitScenario: `Direct API manipulation bypasses client-side business logic checks.`,
                        impact: 'Logic bypass',
                        reproductionSteps: [`1. Send POST to ${api} with body: ${payloadStr}`, `2. Observe: server responded with HTTP ${res.status}`]
                    });
                    findings.push({ type: 'Logic Flaw', endpoint: api });
                    break; // One finding per endpoint is enough
                }
            } catch (_) { }
        }
        return findings;
    }
}

module.exports = BusinessLogicAgent;
