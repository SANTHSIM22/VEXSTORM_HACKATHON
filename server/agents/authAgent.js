const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const { chat, analyzeResponse } = require('../llm/mistralClient');

class AuthAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('AuthAgent', 'A07 - Auth Failures', logger, memory, findingsStore);
        this.goal = "Identify authentication and session management weaknesses, including brute-force vulnerabilities, weak credentials, and insecure cookie configurations through behavioral analysis.";
    }

    async execute(target) {
        this.logger.info(`[AuthAgent] Goal: ${this.goal}`);
        const findings = [];
        const { forms, apiEndpoints, urls } = this.memory.attackSurface;

        // 1. REASONING: Identify sensitive endpoints
        const sensitiveEndpoints = [
            ...forms.filter(f => f.hasPasswordField || /login|auth/i.test(f.action)).map(f => ({ target: f.action, type: 'form', data: f })),
            ...(apiEndpoints || []).filter(a => /login|auth|session/i.test(a)).map(a => ({ target: a, type: 'api' }))
        ];

        this.logger.info(`[AuthAgent] Identified ${sensitiveEndpoints.length} potential authentication endpoints.`);

        // 2. COOKIE & STATIC CHECKS
        await this._checkCookies(target);
        await this._checkStaticFormVulnerabilities(forms);

        // 3. BRUTE FORCE / RATE LIMIT TEST
        for (const ep of sensitiveEndpoints.slice(0, 3)) {
            await this._testRateLimiting(ep.target);
        }

        // 4. WEAK CREDENTIALS API TEST
        const loginApis = (apiEndpoints || []).filter(a => /login|auth|signin/i.test(a));
        for (const api of [...new Set(loginApis)].slice(0, 5)) {
            await this._testWeakCredentials(api);
        }

        // 5. JWT & TOKEN CHECKS
        for (const url of urls.slice(0, 10)) {
            await this._checkJWTInResponse(url);
        }

        return findings;
    }

    async _checkStaticFormVulnerabilities(forms) {
        for (const form of forms.filter(f => f.hasPasswordField || /login/i.test(f.action))) {
            if (form.action && form.action.startsWith('http:')) {
                this.addFinding({
                    type: 'Authentication Weakness',
                    endpoint: form.action,
                    description: 'Login form submits credentials over insecure HTTP',
                    confidenceScore: 0.95,
                    impact: 'Credential compromise',
                    reproductionSteps: [`Check if form action is HTTP: ${form.action}`]
                });
            }
            if (!form.hasCsrfToken) {
                this.addFinding({
                    type: 'Authentication Weakness',
                    endpoint: form.action,
                    description: 'Login form lacks CSRF protection',
                    confidenceScore: 0.8,
                    impact: 'Login CSRF',
                    reproductionSteps: [`Inspect form at ${form.action} for CSRF tokens`]
                });
            }
            const passFields = form.inputs.filter(i => i.type === 'password');
            for (const pf of passFields) {
                if (!pf.autocomplete || pf.autocomplete !== 'off') {
                    this.addFinding({
                        type: 'Authentication Weakness',
                        endpoint: form.action,
                        parameter: pf.name,
                        description: 'Password field allows autocomplete',
                        confidenceScore: 0.5,
                        impact: 'Credential exposure',
                        reproductionSteps: [`Check autocomplete attribute on password field "${pf.name}"`]
                    });
                }
            }
        }
    }

    async _testRateLimiting(endpoint) {
        this.logger.info(`[AuthAgent] Testing rate limiting on: ${endpoint}`);
        const startTime = Date.now();
        const count = 10;
        const attempts = Array.from({ length: count }).map(() =>
            makeRequest(endpoint, { method: 'POST', data: { user: 'test', password: 'wrong' }, retries: 0 })
        );

        try {
            const results = await Promise.allSettled(attempts);
            const duration = Date.now() - startTime;
            const statuses = results.map(r => r.status === 'fulfilled' ? r.value.status : 0);

            const analysis = await analyzeResponse({
                vulnType: 'Auth Failure / Rate Limiting',
                status: statuses[0],
                body: `Completed ${count} attempts in ${duration}ms. Statuses: ${statuses.join(',')}`,
                payload: 'Multiple rapid requests'
            });

            if (analysis.suspicious || (!statuses.includes(429) && duration < 2000)) {
                this.addFinding({
                    type: 'Missing Rate Limiting',
                    endpoint: endpoint,
                    description: `Endpoint lacks brute force protection. ${analysis.reasoning || ''}`,
                    evidence: `${count} attempts in ${duration}ms. Statuses: ${[...new Set(statuses)].join(',')}`,
                    confidenceScore: 0.8,
                    impact: 'Account takeover',
                    reproductionSteps: [`Send ${count} requests rapidly to ${endpoint}`]
                });
            }
        } catch (_) { }
    }

    async _testWeakCredentials(api) {
        let creds = [];
        const domain = new URL(api).hostname;
        const surface = this.memory.attackSurface;

        try {
            // Collect context for LLM: discovered emails, usernames, and domain name
            const discoveredEmails = [...new Set(this.findingsStore.all()
                .filter(f => f.type === 'Information Disclosure' && f.evidence?.includes('@'))
                .map(f => f.evidence.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g))
                .flat().filter(Boolean))];

            const context = `
            Target Domain: ${domain}
            Discovered Emails: ${JSON.stringify(discoveredEmails.slice(0, 5))}
            Sample Endpoints: ${JSON.stringify((surface.urls || []).slice(0, 5))}
            Sample JS Files: ${JSON.stringify((surface.jsFiles || []).slice(0, 3))}
            `;

            const prompt = `You are an expert penetration tester. Based on the target context, generate 8 FEASIBLE credential combinations to test.
            Include common defaults (admin, test, user, root) but adapt emails/usernames to the target domain or discovered data.
            Target Context: ${context}
            Return ONLY a JSON array of objects: [{"email": "...", "password": "..."}, {"username": "...", "password": "..."}]`;

            const raw = await chat("You are a credential reasoning engine.", prompt);
            creds = JSON.parse(raw.replace(/```json\n?|```/g, '').trim());
            this.logger.info(`[AuthAgent] LLM generated ${creds.length} feasible credentials for ${domain}`);
        } catch (e) {
            this.logger.warn(`[AuthAgent] Dynamic credential generation failed, using safety defaults: ${e.message}`);
            creds = [
                { email: `admin@${domain}`, password: 'admin' },
                { username: 'admin', password: 'password' },
                { username: 'root', password: 'root' }
            ];
        }

        for (const cred of creds) {
            try {
                const res = await makeRequest(api, {
                    method: 'POST',
                    data: cred,
                    retries: 0,
                    timeout: 5000
                });

                // Adaptive success detection
                const successIndicators = [
                    res.status === 200 && (res.data.token || res.data.success || res.data.authentication),
                    res.status === 302 && res.headers['set-cookie'],
                    res.data?.user?.email === cred.email
                ];

                if (successIndicators.some(i => i)) {
                    this.addFinding({
                        type: 'Authentication Weakness',
                        endpoint: api,
                        description: `Successful login with feasible credential: ${cred.username || cred.email}`,
                        evidence: `Credential: ${JSON.stringify(cred)}. Indicator: ${res.data.token ? 'JWT returned' : 'Cookie/Session established'}`,
                        confidenceScore: 0.95,
                        impact: 'Full account takeover and data access',
                        reproductionSteps: [
                            `1. Run: curl -X POST "${api}" -H "Content-Type: application/json" -d '${JSON.stringify(cred)}'`,
                            `2. Observe the successful authentication response or session cookie.`
                        ]
                    });
                    break; // Stop after first successful takeover
                }
            } catch (_) { }
        }
    }

    async _checkJWTInResponse(url) {
        try {
            const res = await makeRequest(url);
            const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
            const jwts = body.match(jwtPattern);
            if (jwts) {
                for (const jwt of jwts) {
                    try {
                        const parts = jwt.split('.');
                        const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
                        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

                        if (header.alg === 'none' || header.alg === 'HS256') {
                            this.addFinding({
                                type: 'JWT Weakness',
                                endpoint: url,
                                description: `Insecure JWT algorithm detected: ${header.alg}`,
                                evidence: `Header: ${JSON.stringify(header)}, Payload Snippet: ${JSON.stringify(payload).substring(0, 50)}...`,
                                confidenceScore: 0.9,
                                impact: 'Potential token forgery or privilege escalation',
                                reproductionSteps: [`Find JWT in response from ${url} and verify 'alg' header at jwt.io`]
                            });
                        }

                        if (JSON.stringify(payload).toLowerCase().includes('admin')) {
                            this.addFinding({
                                type: 'Session Weakness',
                                endpoint: url,
                                description: 'Sensitive information (admin role) exposed in client-side JWT',
                                evidence: `Payload: ${JSON.stringify(payload)}`,
                                confidenceScore: 0.85,
                                impact: 'Information disclosure, privilege escalation target',
                                reproductionSteps: [`Examine JWT payload from ${url} for sensitive claims`]
                            });
                        }
                    } catch (_) { }
                }
            }
        } catch (_) { }
    }

    async _checkCookies(target) {
        try {
            const res = await makeRequest(target, { retries: 0 });
            const cookies = [].concat(res.headers['set-cookie'] || []);
            for (const cookie of cookies) {
                if (!/httponly/i.test(cookie) || !/secure/i.test(cookie)) {
                    this.addFinding({
                        type: 'Session Weakness',
                        endpoint: target,
                        parameter: cookie.split('=')[0],
                        description: 'Insecure cookie flags',
                        evidence: `Cookie: ${cookie}`,
                        confidenceScore: 0.9,
                        impact: 'Session hijacking',
                        reproductionSteps: [`Check set-cookie header for Secure/HttpOnly flags`]
                    });
                }
            }
        } catch (_) { }
    }
}

module.exports = AuthAgent;
