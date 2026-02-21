const { Mistral } = require('@mistralai/mistralai');
const { MISTRAL_API_KEY } = require('../config');

let client = null;

function getClient() {
    if (!client) {
        client = new Mistral({ apiKey: MISTRAL_API_KEY });
    }
    return client;
}

async function chat(systemPrompt, userPrompt, options = {}) {
    const c = getClient();
    const maxRetries = options.retries || 2;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await c.chat.complete({
                model: options.model || 'mistral-small-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: options.temperature || 0.3,
                maxTokens: options.maxTokens || 2048,
            });
            return response.choices[0].message.content;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }
    }
    throw new Error(`Mistral API failed after ${maxRetries} attempts: ${lastError.message}`);
}

async function generatePayloads(context) {
    const systemPrompt = `You are a cybersecurity expert specializing in penetration testing payload generation. 
Generate test payloads for the given vulnerability type and context. 
Return ONLY a JSON array of payload strings. No explanations.
Example: ["payload1", "payload2", "payload3"]`;

    const userPrompt = `Generate ${context.count || 5} test payloads for:
Vulnerability Type: ${context.vulnType}
Target Context: ${context.targetContext || 'web application'}
Input Field: ${context.inputField || 'generic input'}
${context.additionalInfo ? 'Additional Info: ' + context.additionalInfo : ''}`;

    const result = await chat(systemPrompt, userPrompt);
    try {
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return result.split('\n').filter(l => l.trim()).map(l => l.replace(/^["'\-\d.)\s]+/, '').trim());
    }
}

async function planScanStrategy(attackSurface) {
    const systemPrompt = `You are a cybersecurity scan planner. Based on the attack surface data, create a prioritized scan plan.
Return JSON with format: { "priority": ["agent1", "agent2"], "reasoning": "...", "riskAreas": ["area1"] }`;

    const userPrompt = `Plan a vulnerability scan for this attack surface:
URLs found: ${attackSurface.urls?.length || 0}
Forms found: ${attackSurface.forms?.length || 0}
Parameters found: ${attackSurface.parameters?.length || 0}
API Endpoints: ${attackSurface.apiEndpoints?.length || 0}
JS Files: ${attackSurface.jsFiles?.length || 0}

Sample URLs: ${JSON.stringify((attackSurface.urls || []).slice(0, 10))}
Sample Forms: ${JSON.stringify((attackSurface.forms || []).slice(0, 5))}
Sample Params: ${JSON.stringify((attackSurface.parameters || []).slice(0, 10))}`;

    const result = await chat(systemPrompt, userPrompt);
    try {
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return { priority: ['injection', 'xss', 'config', 'auth', 'ssrf', 'accessControl', 'crypto', 'dependency', 'integrity', 'logging'], reasoning: result, riskAreas: [] };
    }
}

async function generateRemediation(finding, techContext = {}) {
    const systemPrompt = `You are a concise security auditor. Provide a TIGHT remediation for the finding.
STRICT RULES:
1. NO generic technical background or corporate fluff.
2. NO long "Preventive Security Controls" sections.
3. Provide a specific, 1-line "How it was confirmed" based on the evidence.
4. Provide a 1-2 line "How to simulate" using a simple CLI command (e.g., curl).
5. Provide a specific code fix for the inferred stack.
KEEP THE TOTAL RESPONSE UNDER 15 LINES. No conversational headers.`;

    const userPrompt = `Remediate:
Vulnerability: ${finding.type} (${finding.parameter || 'N/A'})
Endpoint: ${finding.endpoint}
Evidence Snippet: ${typeof finding.evidence === 'string' ? finding.evidence.substring(0, 200) : 'N/A'}

Context:
Inferred Stack: ${techContext.inferredStack || 'Unknown'}
Server Info: ${techContext.serverHeaders || 'Unknown'}`;

    return await chat(systemPrompt, userPrompt);
}

async function analyzeResponse(context) {
    const systemPrompt = `You are a security response analyzer. Analyze the HTTP response for potential vulnerabilities.
Return JSON: { "suspicious": true/false, "indicators": ["indicator1"], "confidence": 0.0-1.0, "reasoning": "..." }`;

    const userPrompt = `Analyze this response for ${context.vulnType} indicators:
Status: ${context.status}
Headers: ${JSON.stringify(context.headers || {})}
Body snippet: ${(context.body || '').substring(0, 1500)}
Original payload: ${context.payload || 'N/A'}`;

    const result = await chat(systemPrompt, userPrompt);
    try {
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return { suspicious: false, indicators: [], confidence: 0, reasoning: result };
    }
}

module.exports = { chat, generatePayloads, planScanStrategy, generateRemediation, analyzeResponse };
