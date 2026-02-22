const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const { chat, analyzeResponse } = require('../llm/mistralClient');

class AuthAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('AuthAgent', 'A07 - Auth Failures', logger, memory, findingsStore, registryRef);
        this.goal = "Identify authentication and session management weaknesses, including brute-force vulnerabilities, weak credentials, and insecure cookie configurations through behavioral analysis.";
    }

    /**
     * Calculates confidence score for authentication findings based on evidence signals.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'httpForm' | 'csrf' | 'autocomplete' | 'rateLimit' | 'weakCreds' | 'jwtAlgo' | 'jwtInfo' | 'cookie'
     * @param {boolean} factors.isHttp - Uses insecure HTTP transport
     * @param {boolean} factors.hasPasswordField - Form has a password field
     * @param {boolean} factors.noCsrfToken - No CSRF token present
     * @param {boolean} factors.no429 - No 429 rate-limit response received
     * @param {number}  factors.requestDuration - Duration of rapid requests in ms
     * @param {boolean} factors.llmConfirms - LLM analysis confirms suspicion
     * @param {boolean} factors.tokenReturned - Auth token returned on login
     * @param {boolean} factors.sessionEstablished - Session cookie set
     * @param {boolean} factors.emailMatched - Response email matches cred email
     * @param {string}  factors.algorithm - JWT algorithm (e.g. 'none', 'HS256')
     * @param {boolean} factors.containsAdminClaim - JWT payload contains admin role
     * @param {boolean} factors.hasRoleClaim - JWT payload has explicit role/admin claim
     * @param {boolean} factors.missingHttpOnly - Cookie missing HttpOnly flag
     * @param {boolean} factors.missingSecure - Cookie missing Secure flag
     * @param {number}  factors.successIndicatorCount - Number of login success indicators triggered
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType, isHttp = false, hasPasswordField = false, noCsrfToken = false, no429 = false, requestDuration = Infinity, llmConfirms = false, tokenReturned = false, sessionEstablished = false, emailMatched = false, algorithm = '', containsAdminClaim = false, hasRoleClaim = false, missingHttpOnly = false, missingSecure = false, successIndicatorCount = 0 }) {
        let score = 0;

        switch (vulnType) {
            case 'httpForm':
                score = 0.5;
                if (isHttp) score += 0.3;
                if (hasPasswordField) score += 0.15;
                break;
            case 'csrf':
                score = 0.35;
                if (noCsrfToken) score += 0.3;
                if (hasPasswordField) score += 0.15;
                break;
            case 'autocomplete':
                score = 0.2;
                if (hasPasswordField) score += 0.2;
                // lower confidence since this is a best-practice issue, not a direct exploit
                break;
            case 'rateLimit':
                score = 0.3;
                if (no429) score += 0.2;
                if (requestDuration < 2000) score += 0.15;
                if (llmConfirms) score += 0.15;
                break;
            case 'weakCreds':
                score = 0.4;
                if (tokenReturned) score += 0.25;
                if (sessionEstablished) score += 0.15;
                if (emailMatched) score += 0.1;
                if (successIndicatorCount >= 2) score += 0.1;
                break;
            case 'jwtAlgo':
                score = 0.4;
                if (algorithm === 'none') score += 0.5;
                else if (algorithm === 'HS256') score += 0.25;
                break;
            case 'jwtInfo':
                score = 0.35;
                if (containsAdminClaim) score += 0.3;
                if (hasRoleClaim) score += 0.2;
                break;
            case 'cookie':
                score = 0.4;
                if (missingHttpOnly) score += 0.25;
                if (missingSecure) score += 0.25;
                break;
            default:
                score = 0.5;
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        this.logger.info(`[AuthAgent] Goal: ${this.goal}`);
        const findings = [];
        const { forms, apiEndpoints, urls } = this.memory.attackSurface;

        // 1. REASONING: Identify sensitive endpoints
        // Only target actual login/signin endpoints, NOT every URL containing "auth"
        // (auth/refresh, auth/logout, auth/verify are NOT login endpoints)
        const LOGIN_PATH_RE = /login|signin|sign-in|log-in/i;
        const AUTH_NON_LOGIN_RE = /refresh|logout|log-out|verify|confirm|reset|forgot|register|signup|sign-up|callback|token\/revoke/i;

        const isLoginEndpoint = (urlStr) => {
            if (LOGIN_PATH_RE.test(urlStr)) return true;
            // If URL has "auth" but also a non-login suffix, skip it
            if (/auth/i.test(urlStr) && AUTH_NON_LOGIN_RE.test(urlStr)) return false;
            // Bare /auth or /api/auth (without further path) could be login
            if (/\/auth\/?$/i.test(urlStr) || /\/auth\/?\?/i.test(urlStr)) return true;
            return false;
        };

        const sensitiveEndpoints = [
            ...forms.filter(f => f.hasPasswordField || LOGIN_PATH_RE.test(f.action)).map(f => ({ target: f.action, type: 'form', data: f })),
            ...(apiEndpoints || []).filter(a => isLoginEndpoint(a) || /session/i.test(a)).map(a => ({ target: a, type: 'api' }))
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
        const loginApis = (apiEndpoints || []).filter(a => isLoginEndpoint(a));
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
                    confidenceScore: this._calculateConfidence({ vulnType: 'httpForm', isHttp: true, hasPasswordField: form.hasPasswordField }),
                    impact: 'Credential compromise',
                    reproductionSteps: [`Check if form action is HTTP: ${form.action}`]
                });
            }
            if (!form.hasCsrfToken) {
                this.addFinding({
                    type: 'Authentication Weakness',
                    endpoint: form.action,
                    description: 'Login form lacks CSRF protection',
                    confidenceScore: this._calculateConfidence({ vulnType: 'csrf', noCsrfToken: true, hasPasswordField: form.hasPasswordField }),
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
                        confidenceScore: this._calculateConfidence({ vulnType: 'autocomplete', hasPasswordField: true }),
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
                    confidenceScore: this._calculateConfidence({ vulnType: 'rateLimit', no429: !statuses.includes(429), requestDuration: duration, llmConfirms: !!analysis.suspicious }),
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

        // First, capture a baseline: send obviously bad credentials to see what
        // a failed login looks like (status, cookies, body shape).
        let baselineStatus = 0;
        let baselineCookieCount = 0;
        let baselineBodyKeys = [];
        try {
            const baseRes = await makeRequest(api, { method: 'POST', data: { email: 'ZZnonexistent@invalid.tld', password: 'ZZZbadpass999!!!' }, retries: 0, timeout: 5000 });
            baselineStatus = baseRes.status;
            baselineCookieCount = [].concat(baseRes.headers['set-cookie'] || []).length;
            if (baseRes.data && typeof baseRes.data === 'object') baselineBodyKeys = Object.keys(baseRes.data);
        } catch (_) { }

        for (const cred of creds) {
            try {
                const res = await makeRequest(api, {
                    method: 'POST',
                    data: cred,
                    retries: 0,
                    timeout: 5000
                });

                const body = res.data || {};
                const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
                const cookies = [].concat(res.headers['set-cookie'] || []);

                // ── Robust success detection ──
                // A login is only "successful" when MULTIPLE strong signals align.
                // A cookie alone is NOT enough (sites set tracking/CSRF cookies on failures too).

                // Strong signals (each worth 1 point)
                let score = 0;
                const signals = [];

                // 1. JWT / access token in response body
                const hasToken = !!(body.token || body.access_token || body.accessToken || body.authentication?.token);
                if (hasToken) { score += 2; signals.push('auth token returned'); }

                // 2. Explicit success field that is truthy
                const hasExplicitSuccess = body.success === true || body.authenticated === true || body.status === 'success';
                if (hasExplicitSuccess) { score += 2; signals.push('explicit success field'); }

                // 3. User object in response (with email/name)
                const hasUserObj = !!(body.user || body.profile || body.account);
                if (hasUserObj) { score += 1; signals.push('user object returned'); }

                // 4. Email match — response contains the credential's email
                const emailMatch = !!(cred.email && bodyStr.includes(cred.email));
                if (emailMatch) { score += 1; signals.push('email matched in response'); }

                // 5. Status code improved vs baseline (e.g. baseline 401 → now 200)
                const statusImproved = res.status === 200 && baselineStatus >= 400;
                if (statusImproved) { score += 1; signals.push(`status improved: ${baselineStatus} → ${res.status}`); }

                // 6. New cookies set that weren't in the baseline failure response
                const newCookies = cookies.length > baselineCookieCount;
                if (newCookies) { score += 0.5; signals.push('new cookies set vs baseline'); }

                // 7. 302 redirect to a non-login page (dashboard, home, etc.)
                const redirectToApp = res.status === 302 && res.headers['location']
                    && !/login|signin|sign-in|auth|error/i.test(res.headers['location']);
                if (redirectToApp) { score += 1.5; signals.push(`redirect to ${res.headers['location']}`); }

                // Negative signals — penalize responses that look like failures
                const hasErrorField = body.error || body.message?.toLowerCase?.()?.includes?.('invalid')
                    || body.message?.toLowerCase?.()?.includes?.('unauthorized')
                    || body.message?.toLowerCase?.()?.includes?.('incorrect');
                if (hasErrorField) { score -= 2; signals.push('error/invalid message in body'); }

                if (res.status === 401 || res.status === 403) { score -= 2; signals.push(`status ${res.status} = rejection`); }

                // body.success === false is explicitly a failure
                if (body.success === false) { score -= 2; signals.push('success: false'); }

                // Threshold: need at least 2 points to consider it a real login
                this.logger.debug?.(`[AuthAgent] ${cred.username || cred.email} score=${score} signals=[${signals.join(', ')}]`);

                if (score >= 2) {
                    this.addFinding({
                        type: 'Authentication Weakness',
                        endpoint: api,
                        description: `Successful login with weak credential: ${cred.username || cred.email}`,
                        evidence: `Credential: ${JSON.stringify(cred)}. Signals: ${signals.filter(s => !s.startsWith('error') && !s.startsWith('status 4') && !s.startsWith('success:')).join(', ')}`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'weakCreds', tokenReturned: hasToken, sessionEstablished: redirectToApp || (newCookies && statusImproved), emailMatched: emailMatch, successIndicatorCount: Math.floor(score) }),
                        impact: 'Full account takeover and data access',
                        reproductionSteps: [
                            `1. Run: curl -X POST "${api}" -H "Content-Type: application/json" -d '${JSON.stringify(cred)}'`,
                            `2. Observe the successful authentication response.`,
                            `3. Evidence: ${signals.filter(s => !s.startsWith('error')).join('; ')}`
                        ]
                    });
                    break; // Stop after first confirmed takeover
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
                                confidenceScore: this._calculateConfidence({ vulnType: 'jwtAlgo', algorithm: header.alg }),
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
                                confidenceScore: this._calculateConfidence({ vulnType: 'jwtInfo', containsAdminClaim: true, hasRoleClaim: !!(payload.role || payload.isAdmin || payload.admin) }),
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
        // Only flag cookies that look like session/auth identifiers.
        // Tracking cookies, analytics cookies, preference cookies, CSRF tokens etc.
        // don't need HttpOnly/Secure and flagging them creates noise.
        const SESSION_COOKIE_RE = /^(sess|session|sid|ssid|connect\.sid|jsessionid|phpsessid|asp\.net_sessionid|_session|auth|token|jwt|access|refresh|remember|login|user_session)/i;
        const IGNORED_COOKIE_RE = /^(_ga|_gid|_gat|_fbp|_gcl|utm_|__utm|_hjid|hubspot|intercom|crisp|drift|__cf|cf_|__stripe|_pk_|mp_|amplitude|__zlcmid|ajs_|_dc_|optimizely|__hstc|__hssc|__hssrc|csrftoken|_csrf|xsrf)/i;

        try {
            const res = await makeRequest(target, { retries: 0 });
            const cookies = [].concat(res.headers['set-cookie'] || []);
            for (const cookie of cookies) {
                const cookieName = (cookie.split('=')[0] || '').trim();

                // Skip non-session cookies (analytics, tracking, CSRF)
                if (IGNORED_COOKIE_RE.test(cookieName)) continue;

                // Only flag cookies that look like session identifiers
                // OR cookies that carry a substantial value (not just 'true'/'1')
                const cookieValue = (cookie.split(';')[0]?.split('=').slice(1).join('=') || '').trim();
                const looksLikeSession = SESSION_COOKIE_RE.test(cookieName)
                    || cookieValue.length > 20; // Long opaque values are likely session IDs

                if (!looksLikeSession) continue;

                const missingHttpOnly = !/httponly/i.test(cookie);
                const missingSecure = !/secure/i.test(cookie);

                if (missingHttpOnly || missingSecure) {
                    const issues = [];
                    if (missingHttpOnly) issues.push('HttpOnly');
                    if (missingSecure) issues.push('Secure');

                    this.addFinding({
                        type: 'Session Weakness',
                        endpoint: target,
                        parameter: cookieName,
                        description: `Session cookie "${cookieName}" missing ${issues.join(' and ')} flag${issues.length > 1 ? 's' : ''}`,
                        evidence: `Cookie: ${cookie}`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'cookie', missingHttpOnly, missingSecure }),
                        impact: 'Session hijacking via XSS or network sniffing',
                        reproductionSteps: [
                            `1. Run: curl -sI "${target}" | grep -i set-cookie`,
                            `2. Verify cookie "${cookieName}" is missing: ${issues.join(', ')}`
                        ]
                    });
                }
            }
        } catch (_) { }
    }
}

module.exports = AuthAgent;
