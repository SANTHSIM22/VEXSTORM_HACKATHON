const BaseAgent = require('./baseAgent');
const { makeRequest, timedRequest } = require('../utils/httpClient');
const ValidationEngine = require('../engine/validationEngine');
const { URL } = require('url');

const AC_TIMEOUT = 6000;

class AccessControlAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('AccessControlAgent', 'A01 - Broken Access Control', logger, memory, findingsStore, registryRef);
        this.validator = new ValidationEngine(logger);
    }

    /**
     * Calculates confidence score for access control findings based on evidence signals.
     * @param {object} factors
     * @param {boolean} factors.systemFileDetected - Whether system file content (e.g. /etc/passwd) was found in response
     * @param {number}  factors.anomalyScore - Response anomaly score from validation engine (0-1)
     * @param {boolean} factors.statusIs200 - Whether the HTTP response status was 200
     * @param {boolean} factors.contentDiffers - Whether response content changed with the payload
     * @param {number}  factors.contentLength - Length of response body
     * @param {boolean} factors.paramNameRelevant - Whether the parameter name strongly matches the vuln type
     * @param {string}  factors.vulnType - 'traversal' | 'idor' | 'forcedBrowsing'
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ systemFileDetected = false, anomalyScore = 0, statusIs200 = false, contentDiffers = false, contentLength = 0, paramNameRelevant = false, vulnType = 'traversal' }) {
        let score = 0;

        if (vulnType === 'traversal') {
            score = 0.15;                                          // base
            if (systemFileDetected) score += 0.55;                 // definitive proof
            if (anomalyScore > 0) score += Math.min(anomalyScore * 0.3, 0.3); // behavioral signal
            if (statusIs200) score += 0.05;                        // server accepted
            if (paramNameRelevant) score += 0.05;                  // param name matches file-like pattern
        } else if (vulnType === 'idor') {
            score = 0.15;                                          // base
            if (statusIs200) score += 0.1;                         // both returned 200
            if (contentDiffers) score += 0.15;                     // different content for different IDs
            if (contentLength > 500) score += 0.1;                 // substantial response bodies
            else if (contentLength > 100) score += 0.05;
            if (paramNameRelevant) score += 0.1;                   // param name strongly matches ID-like pattern
        } else if (vulnType === 'forcedBrowsing') {
            score = 0.25;                                          // base
            if (statusIs200) score += 0.2;                         // page loads successfully
            if (contentLength > 500) score += 0.15;                // has substantial content (not just a redirect page)
            else if (contentLength > 100) score += 0.1;
            if (paramNameRelevant) score += 0.1;                   // path contains sensitive keywords like 'admin'
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        const findings = [];
        const { parameters } = this.memory.attackSurface;
        const baseOrigin = new URL(target).origin;

        // Phase 1: Path traversal
        const fileParams = parameters.filter(p =>
            /file|path|page|template|doc|include|dir|folder|name|resource/i.test(p.param)
        );
        const seenFile = new Set();

        for (const param of fileParams) {
            if (seenFile.has(param.param)) continue;
            seenFile.add(param.param);
            if (seenFile.size > 5) break;

            try {
                let baselineResponse;
                try { baselineResponse = await timedRequest(param.url, { timeout: AC_TIMEOUT }); } catch { continue; }
                const baseline = this.validator.captureBaseline(baselineResponse);

                const traversalPayloads = [
                    '../../../etc/passwd',
                    '....//....//....//etc/passwd',
                    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
                ];

                for (const payload of traversalPayloads) {
                    const testUrl = new URL(param.url);
                    testUrl.searchParams.set(param.param, payload);
                    const testResponse = await timedRequest(testUrl.toString(), { timeout: AC_TIMEOUT });
                    const body = typeof testResponse.data === 'string' ? testResponse.data : '';
                    const comparison = this.validator.compareResponses(baseline, testResponse);

                    if (/root:|daemon:|nobody:|Administrator/i.test(body)) {
                        this.addFinding({
                            type: 'Path Traversal',
                            endpoint: param.url,
                            parameter: param.param,
                            description: `Path traversal vulnerability via "${param.param}" parameter`,
                            evidence: `System file contents detected in response with payload: ${payload}`,
                            payload,
                            confidenceScore: this._calculateConfidence({ vulnType: 'traversal', systemFileDetected: true, anomalyScore: comparison.anomalyScore, statusIs200: testResponse.status === 200, paramNameRelevant: /file|path|include|dir/i.test(param.param) }),
                            exploitScenario: `Attacker reads arbitrary files via "${param.param}" parameter`,
                            impact: 'Arbitrary file read—credentials, configuration, and source code exposure',
                            reproductionSteps: [
                                `1. Open the following URL:`,
                                `   ${testUrl.toString()}`,
                                `2. The parameter "${param.param}" is set to: ${payload}`,
                                `3. Observe: the response contains system file contents (e.g. /etc/passwd entries)`,
                                `4. This confirms the server is reading arbitrary files from the filesystem`,
                            ],
                        });
                        break;
                    } else if (comparison.anomalyScore > 0.4) {
                        this.addFinding({
                            type: 'Path Traversal',
                            endpoint: param.url,
                            parameter: param.param,
                            description: `Possible path traversal via "${param.param}" - response differs significantly`,
                            evidence: `Anomaly score: ${comparison.anomalyScore} with payload: ${payload}`,
                            payload,
                            confidenceScore: this._calculateConfidence({ vulnType: 'traversal', systemFileDetected: false, anomalyScore: comparison.anomalyScore, statusIs200: testResponse.status === 200, paramNameRelevant: /file|path|include|dir/i.test(param.param) }),
                            exploitScenario: `Parameter "${param.param}" may allow directory traversal`,
                            impact: 'Potential file access',
                            reproductionSteps: [
                                `1. Open: ${testUrl.toString()}`,
                                `2. The response is significantly different from normal (anomaly score: ${comparison.anomalyScore})`,
                                `3. This suggests the parameter may be used for file inclusion`,
                            ],
                        });
                    }
                }
            } catch (_) { }
        }

        // Phase 2: IDOR
        const idParams = parameters.filter(p => /id|uid|user_id|account|order|num|no/i.test(p.param));
        const seenId = new Set();

        for (const param of idParams) {
            if (seenId.has(param.param)) continue;
            seenId.add(param.param);
            if (seenId.size > 3) break;

            try {
                const testUrl1 = new URL(param.url);
                testUrl1.searchParams.set(param.param, '1');
                const response1 = await timedRequest(testUrl1.toString(), { timeout: AC_TIMEOUT });

                const testUrl2 = new URL(param.url);
                testUrl2.searchParams.set(param.param, '2');
                const response2 = await timedRequest(testUrl2.toString(), { timeout: AC_TIMEOUT });

                if (response1.status === 200 && response2.status === 200) {
                    const body1 = typeof response1.data === 'string' ? response1.data : '';
                    const body2 = typeof response2.data === 'string' ? response2.data : '';

                    if (body1 !== body2 && body1.length > 100 && body2.length > 100) {
                        this.addFinding({
                            type: 'IDOR',
                            endpoint: param.url,
                            parameter: param.param,
                            description: `Possible IDOR - sequential ID access on "${param.param}" returns different data`,
                            evidence: `ID=1 and ID=2 both return 200 with different content`,
                            confidenceScore: this._calculateConfidence({ vulnType: 'idor', statusIs200: true, contentDiffers: true, contentLength: Math.min(body1.length, body2.length), paramNameRelevant: /id|uid|user_id|account/i.test(param.param) }),
                            exploitScenario: `Attacker enumerates ${param.param} values to access other users' data`,
                            impact: "Unauthorized access to other users' data",
                            reproductionSteps: [
                                `1. Open: ${testUrl1.toString()}`,
                                `2. Then open: ${testUrl2.toString()}`,
                                `3. Both return HTTP 200 with different content`,
                                `4. Incrementing the "${param.param}" parameter accesses different records without authorization`,
                            ],
                        });
                    }
                }
            } catch (_) { }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Phase 3: Forced Browsing — Unauthenticated Admin Access
        //
        // WHAT WE TEST:
        //   We probe a set of well-known admin/management paths to check whether
        //   the server serves real admin content to unauthenticated requests.
        //
        // HOW WE AVOID FALSE-POSITIVES (SPA/Next.js/React):
        //   1. HTTP redirect detection  — we make TWO requests:
        //        a) maxRedirects:0 → catch the raw 302/301 before it lands on a 200 login page
        //        b) maxRedirects:5 → follow to get the final response for content inspection
        //   2. Homepage baseline fingerprint — we fetch the root URL first and extract:
        //        • <title> text
        //        • root element id (root / app / __next)
        //        • first 400 chars of <head> (meta, link tags)
        //        • body character length
        //      If the admin path returns a response that matches the homepage fingerprint
        //      on ANY of these signals, it is a SPA shell → skip.
        //   3. Embedded 404 detection — Next.js/Nuxt RSC payloads embed notFound:true
        //      even when the HTTP status is 200.
        //   4. Login-page detection on the visible text (after stripping <script>/<style>).
        //   5. JSON API check — if the response is JSON and contains admin-related keys,
        //      it is a real finding (an API does NOT return HTML shells).
        //   6. Real admin content gate — we only report if the visible text of the page
        //      contains server-rendered admin UI keywords AND the content is NOT on the
        //      homepage baseline.
        // ─────────────────────────────────────────────────────────────────────

        const ADMIN_PROBE_PATHS = [
            '/admin', '/administrator', '/admin/dashboard',
            '/panel', '/manage', '/backend', '/cp', '/controlpanel',
        ];

        const LOGIN_INDICATORS  = /\b(login|log.?in|sign.?in|signin|forgot.?password|authenticate|sso)\b/i;
        const ADMIN_INDICATORS  = /\b(dashboard|user.?management|system.?settings|manage.?users|control.?panel|admin.?home|analytics|audit.?log|create.?user|delete.?user|permission|role.?management)\b/i;
        const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

        /** Strip <script>, <style> and all tags — leaves only server-rendered visible text. */
        function stripToVisibleText(html) {
            return html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        /** Extract a structural fingerprint from an HTML page. */
        function fingerprint(html) {
            const title    = (html.match(/<title[^>]*>([^<]{0,120})<\/title>/i) || [])[1]?.trim().toLowerCase() || '';
            const rootEl   = (html.match(/<(?:div|main)[^>]+id=["'](?:root|app|__next|__nuxt)[^"']*["']/i) || [])[0] || '';
            const headSnip = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0].slice(0, 400);
            return { title, rootEl, headSnip, len: html.length };
        }

        /** Returns true if the candidate response looks like the same SPA shell as the homepage. */
        function isSameSpaShell(homeFp, candidateHtml) {
            const fp = fingerprint(candidateHtml);
            if (homeFp.title && fp.title && homeFp.title === fp.title)             return true;
            if (homeFp.rootEl && fp.rootEl && homeFp.rootEl === fp.rootEl)         return true;
            if (homeFp.headSnip.length > 80 && fp.headSnip.length > 80
                && homeFp.headSnip.slice(0, 200) === fp.headSnip.slice(0, 200))    return true;
            if (homeFp.len > 0) {
                const ratio = fp.len / homeFp.len;
                if (ratio >= 0.92 && ratio <= 1.08)                                return true;
            }
            return false;
        }

        /** Next.js / Nuxt embed 404 data in RSC payloads even on HTTP 200. */
        function hasEmbedded404(html) {
            return /["']notFound["']\s*:\s*\[/.test(html)
                || /404[:\s]+This page could not be found/i.test(html)
                || /<title[^>]*>\s*404\b/i.test(html)
                || /\bPage Not Found\b/i.test(stripToVisibleText(html).slice(0, 300));
        }

        // ── Step 1: Fetch homepage baseline ──────────────────────────────────
        let homeFp = { title: '', rootEl: '', headSnip: '', len: 0 };
        try {
            const homeResp = await makeRequest(baseOrigin, { retries: 1, timeout: AC_TIMEOUT });
            const homeBody = typeof homeResp.data === 'string' ? homeResp.data : '';
            homeFp = fingerprint(homeBody);
            this.logger.info(`[AccessControlAgent] Homepage fingerprint — title:"${homeFp.title}" len:${homeFp.len}`);
        } catch (_) {
            this.logger.warn('[AccessControlAgent] Could not fetch homepage baseline for SPA detection');
        }

        // ── Step 2: Probe each admin path ────────────────────────────────────
        for (const path of ADMIN_PROBE_PATHS) {
            const probeUrl = `${baseOrigin}${path}`;
            try {
                // ── 2a. Raw request (no redirects) to detect server-level auth redirects ──
                let rawStatus = null;
                let redirectTarget = '';
                try {
                    const rawResp = await makeRequest(probeUrl, { retries: 1, timeout: AC_TIMEOUT, maxRedirects: 0 });
                    rawStatus = rawResp.status;
                    redirectTarget = (rawResp.headers?.location || '').toLowerCase();
                } catch (redirectErr) {
                    // axios throws on 3xx when maxRedirects:0 — extract status from error
                    rawStatus = redirectErr?.response?.status ?? null;
                    redirectTarget = (redirectErr?.response?.headers?.location || '').toLowerCase();
                }

                // Server immediately redirects → protected by server-side auth
                if (rawStatus && REDIRECT_STATUSES.has(rawStatus)) {
                    this.logger.info(`[AccessControlAgent] ${path} — server redirects (${rawStatus} → ${redirectTarget || '?'}) — PROTECTED`);
                    continue;
                }

                // ── 2b. Follow redirects to get final response ──
                const response = await makeRequest(probeUrl, { retries: 1, timeout: AC_TIMEOUT });
                const finalUrl = (response.finalUrl || response.url || probeUrl).toLowerCase();
                const status   = response.status;

                // Not a 200 → not accessible
                if (status !== 200) {
                    this.logger.info(`[AccessControlAgent] ${path} — HTTP ${status} — NOT ACCESSIBLE`);
                    continue;
                }

                const respBody = typeof response.data === 'string' ? response.data : '';
                const contentType = (response.headers?.['content-type'] || '').toLowerCase();

                // ── 2c. JSON API response check ──────────────────────────────────────────
                // An API endpoint returning JSON admin data without auth is a real finding.
                if (contentType.includes('application/json') || (respBody.trimStart().startsWith('{') || respBody.trimStart().startsWith('['))) {
                    try {
                        const parsed = typeof respBody === 'string' ? JSON.parse(respBody) : respBody;
                        const jsonStr = JSON.stringify(parsed).toLowerCase();
                        if (/user|admin|role|permission|email|token|secret/i.test(jsonStr) && jsonStr.length > 50) {
                            const excerpt = JSON.stringify(parsed).slice(0, 200);
                            this.addFinding({
                                type: 'Broken Access Control',
                                endpoint: probeUrl,
                                parameter: 'N/A',
                                description: `Admin API endpoint "${path}" returns sensitive JSON data without authentication`,
                                evidence: `HTTP 200 · Content-Type: application/json · Response excerpt: ${excerpt}`,
                                confidenceScore: 0.85,
                                exploitScenario: `An unauthenticated attacker sends GET ${probeUrl} and receives admin/user data in JSON`,
                                impact: 'Direct data exposure — user records, roles, tokens accessible without login',
                                reproductionSteps: [
                                    `1. Run: curl -s "${probeUrl}"`,
                                    `2. Observe: server returns HTTP 200 with JSON containing sensitive fields`,
                                    `3. No authentication header or cookie is required`,
                                ],
                            });
                        }
                    } catch (_) {}
                    continue;
                }

                // ── 2d. HTML response — SPA/CSR detection ────────────────────────────────

                // Redirect followed to a login URL → server enforces auth via redirect
                if (finalUrl !== probeUrl.toLowerCase() && LOGIN_INDICATORS.test(finalUrl)) {
                    this.logger.info(`[AccessControlAgent] ${path} — redirected to login (${finalUrl}) — PROTECTED`);
                    continue;
                }

                // Embedded 404 in RSC payload (Next.js notFound:true)
                if (hasEmbedded404(respBody)) {
                    this.logger.info(`[AccessControlAgent] ${path} — embedded 404 in RSC payload — NOT ACCESSIBLE`);
                    continue;
                }

                // SPA shell comparison against homepage baseline
                if (isSameSpaShell(homeFp, respBody)) {
                    this.logger.info(`[AccessControlAgent] ${path} — response matches homepage SPA shell — NOT A REAL ADMIN PAGE`);
                    continue;
                }

                // ── 2e. Real content gate ─────────────────────────────────────────────────
                const visibleText = stripToVisibleText(respBody);

                // Login page detected in visible text
                const isLoginPage = LOGIN_INDICATORS.test(visibleText)
                    && /(<form|type=["']?password)/i.test(respBody)
                    && !ADMIN_INDICATORS.test(visibleText);
                if (isLoginPage) {
                    this.logger.info(`[AccessControlAgent] ${path} — login form in visible body — PROTECTED`);
                    continue;
                }

                // Must have REAL admin UI keywords in server-rendered visible text
                const hasRealAdminContent = ADMIN_INDICATORS.test(visibleText) && visibleText.length > 300;
                if (!hasRealAdminContent) {
                    this.logger.info(`[AccessControlAgent] ${path} — no server-rendered admin content in visible text — skipping`);
                    continue;
                }

                // ── 2f. Confirmed: real admin content accessible without auth ─────────────
                const contentExcerpt = visibleText.slice(0, 200).replace(/\s+/g, ' ');
                const confidence = Math.min(1.0, this._calculateConfidence({
                    vulnType: 'forcedBrowsing',
                    statusIs200: true,
                    contentLength: visibleText.length,
                    paramNameRelevant: /admin|manage|backend/i.test(path),
                }) + 0.2); // +0.2 because we confirmed real admin content in visible text

                this.addFinding({
                    type: 'Broken Access Control',
                    endpoint: probeUrl,
                    parameter: 'N/A',
                    description: `Admin panel at "${path}" is accessible without authentication — server-rendered admin UI confirmed`,
                    evidence: `HTTP 200 · No redirect · Real admin content in server-rendered HTML: "${contentExcerpt}"`,
                    confidenceScore: confidence,
                    exploitScenario: `Attacker navigates to ${probeUrl} in a browser without logging in and sees live admin functionality`,
                    impact: 'Full unauthorized admin access — attacker can view, modify, or delete application data',
                    reproductionSteps: [
                        `1. Open a private/incognito browser window (no session cookies)`,
                        `2. Navigate to: ${probeUrl}`,
                        `3. Observe: the admin UI loads without being redirected to a login page`,
                        `4. Server-rendered page contains admin keywords: visible text excerpt: "${contentExcerpt.slice(0, 100)}"`,
                    ],
                });
                this.logger.warn(`[AccessControlAgent] CONFIRMED: ${path} accessible without auth — visible admin content found`);

            } catch (_) { }
        }

        return findings;
    }
}

module.exports = AccessControlAgent;
