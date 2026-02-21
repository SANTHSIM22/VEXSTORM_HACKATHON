const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { chat, analyzeResponse } = require('../llm/mistralClient');

class BusinessLogicAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('BusinessLogicAgent', 'A04 - Insecure Design', logger, memory, findingsStore);
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
        const payloads = type === 'price' ? ['-1', '0'] : ['0', '-1'];
        const inputName = form.inputs.find(i => /price|amount|qty|quantity/i.test(i.name))?.name || form.inputs[0]?.name;

        if (!inputName) return findings;

        for (const payload of payloads) {
            try {
                const data = form.method === 'POST' ? { [inputName]: payload } : undefined;
                const params = form.method === 'GET' ? { [inputName]: payload } : undefined;
                const response = await makeRequest(form.action, { method: form.method, data, params, retries: 0 });

                const analysis = await analyzeResponse({
                    vulnType: 'Business Logic Flaw',
                    status: response.status,
                    body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                    payload
                });

                if (analysis.suspicious || response.status === 200) {
                    this.addFinding({
                        type: 'Insecure Design',
                        endpoint: form.action,
                        parameter: inputName,
                        description: `Business logic flaw: ${type} manipulation. ${analysis.reasoning}`,
                        evidence: `Server accepted value "${payload}". LLM confidence: ${analysis.confidence}`,
                        payload,
                        confidenceScore: this._calculateConfidence({ llmConfidence: analysis.confidence || 0, llmSuspicious: !!analysis.suspicious, serverAccepted: response.status < 400, httpStatus: response.status, payloadIsNegative: payload.startsWith('-'), payloadIsZero: payload === '0', context: 'form' }),
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
        const payload = type === 'price' ? { price: 0 } : { quantity: -1 };
        try {
            const res = await makeRequest(api, { method: 'POST', data: payload, retries: 0 });
            const analysis = await analyzeResponse({
                vulnType: 'Business Logic Flaw',
                status: res.status,
                body: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
                payload: JSON.stringify(payload)
            });

            if (analysis.suspicious || res.status < 400) {
                this.addFinding({
                    type: 'Business Logic Flaw',
                    endpoint: api,
                    parameter: 'JSON Body',
                    description: `API logic manipulation of ${type}. ${analysis.reasoning}`,
                    evidence: `Accepted ${JSON.stringify(payload)} with status ${res.status}`,
                    payload: JSON.stringify(payload),
                    confidenceScore: this._calculateConfidence({ llmConfidence: analysis.confidence || 0, llmSuspicious: !!analysis.suspicious, serverAccepted: res.status < 400, httpStatus: res.status, payloadIsNegative: JSON.stringify(payload).includes('-'), payloadIsZero: JSON.stringify(payload).includes(':0') || JSON.stringify(payload).includes(': 0'), context: 'api' }),
                    exploitScenario: `Direct API manipulation of ${type} bypasses client-side checks.`,
                    impact: 'Logic bypass',
                    reproductionSteps: [`1. Send POST to ${api} with ${JSON.stringify(payload)}`]
                });
                findings.push({ type: 'Logic Flaw', endpoint: api });
            }
        } catch (_) { }
        return findings;
    }
}

module.exports = BusinessLogicAgent;
