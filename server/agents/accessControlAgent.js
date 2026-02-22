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

        // Phase 3: Forced browsing
        // We must distinguish between a real admin panel and a login-redirect page.
        // Many apps/SPAs return 200 at /admin but serve a login shell or loading spinner.
        const adminPaths = ['/admin', '/administrator', '/admin/dashboard', '/panel', '/manage', '/backend'];

        /** Patterns that indicate the response is a login/auth page, not an actual admin panel */
        const LOGIN_INDICATORS = /login|log.in|sign.in|signin|password|forgot.password|authenticate|sso|credentials|username.*password/i;
        /** Patterns that indicate the response is a real admin panel / dashboard */
        const ADMIN_INDICATORS = /dashboard|settings|manage|users.*list|configuration|control.panel|admin.home|analytics|system.status|create.*user|edit.*user|delete|overview/i;

        /**
         * Strip <script>, <style>, and HTML tags to get only visible text content.
         * This prevents script paths like "app/admin/dashboard/page-xxx.js"
         * from falsely matching admin-content patterns.
         */
        function getVisibleText(html) {
            return html
                .replace(/<script[\s\S]*?<\/script>/gi, '')   // remove script blocks
                .replace(/<style[\s\S]*?<\/style>/gi, '')     // remove style blocks
                .replace(/<[^>]+>/g, ' ')                     // strip remaining HTML tags
                .replace(/\s+/g, ' ')                         // collapse whitespace
                .trim();
        }

        /**
         * Detect SPA loading shells – pages that return 200 but only contain
         * a spinner / "Loading…" placeholder with no real content.
         */
        function isSpaLoadingShell(html) {
            const visibleText = getVisibleText(html);
            // Very little visible text (just "Loading…" or a single word)
            if (visibleText.length < 80) return true;
            // Explicit loading-spinner patterns
            if (/^\s*(loading|please wait|redirecting)\b/i.test(visibleText)) return true;
            return false;
        }

        /**
         * Detect Next.js / React embedded 404 in RSC or hydration payload.
         */
        function hasEmbedded404(html) {
            return /\"notFound\":\s*\[/.test(html)
                || /404:\s*This page could not be found/i.test(html)
                || /<title[^>]*>\s*404\b/i.test(html);
        }

        for (const path of adminPaths) {
            try {
                const response = await makeRequest(`${baseOrigin}${path}`, { retries: 1, timeout: AC_TIMEOUT });
                if (response.status === 200) {
                    const respBody = typeof response.data === 'string' ? response.data : '';
                    const visibleText = getVisibleText(respBody);
                    const finalUrl = (response.finalUrl || response.url || '').toLowerCase();
                    const requestedUrl = `${baseOrigin}${path}`.toLowerCase();

                    // ── Quick-skip: SPA loading shell or embedded 404 ──
                    if (isSpaLoadingShell(respBody) || hasEmbedded404(respBody)) {
                        this.logger.debug?.(`[AccessControlAgent] Skipping ${path} — SPA shell / embedded 404`);
                        continue;
                    }

                    // ── Check 1: Was the request redirected to a different URL? ──
                    const wasRedirected = finalUrl !== requestedUrl && finalUrl !== '';

                    // ── Check 2: Does the final URL or visible body look like a login page? ──
                    const finalUrlIsLogin = LOGIN_INDICATORS.test(finalUrl);
                    const bodyHasLoginForm = LOGIN_INDICATORS.test(visibleText)
                        && /(<form|<input|type=.password)/i.test(respBody);
                    const bodyLooksLikeLogin =
                        /<title[^>]*>.*(?:login|sign.in|auth).*<\/title>/i.test(respBody)
                        || (visibleText.length < 2000 && LOGIN_INDICATORS.test(visibleText)
                            && !ADMIN_INDICATORS.test(visibleText));

                    // ── Strong signal: HTTP redirect to a login URL → ALWAYS skip ──
                    // A redirect means the server enforces authentication; the body
                    // content of the login page is irrelevant.
                    if (wasRedirected && finalUrlIsLogin) {
                        this.logger.debug?.(`[AccessControlAgent] Skipping ${path} — redirected to login URL (${finalUrl})`);
                        continue;
                    }

                    // ── Check 3: Does the VISIBLE body contain real admin content? ──
                    // Only visible text counts – script URLs / JSON payloads are excluded.
                    const bodyHasAdminContent = ADMIN_INDICATORS.test(visibleText) && visibleText.length > 200;

                    // Weaker signals: body looks like a login page.
                    // Only skip if there's no real admin content visible alongside the form.
                    if ((bodyHasLoginForm || bodyLooksLikeLogin) && !bodyHasAdminContent) {
                        this.logger.debug?.(`[AccessControlAgent] Skipping ${path} — login form detected in body`);
                        continue;
                    }

                    // If we get here but there's no meaningful visible content, skip.
                    // A real admin panel would have navigation, forms, tables etc.
                    if (visibleText.length < 100 && !bodyHasAdminContent) {
                        this.logger.debug?.(`[AccessControlAgent] Skipping ${path} — no meaningful visible content (${visibleText.length} chars)`);
                        continue;
                    }

                    // Adjust confidence based on real admin content presence
                    const adjustedConfidence = this._calculateConfidence({
                        vulnType: 'forcedBrowsing',
                        statusIs200: true,
                        contentLength: visibleText.length,
                        paramNameRelevant: /admin|manage|backend/i.test(path),
                    }) + (bodyHasAdminContent ? 0.15 : 0);

                    this.addFinding({
                        type: 'Broken Access Control',
                        endpoint: `${baseOrigin}${path}`,
                        parameter: 'N/A',
                        description: `Admin path "${path}" accessible without authentication`,
                        evidence: `HTTP 200 response on ${path}${bodyHasAdminContent ? ' — response contains admin/dashboard content' : ''}`,
                        confidenceScore: Math.min(1.0, adjustedConfidence),
                        exploitScenario: `Attacker accesses ${path} without authentication`,
                        impact: 'Unauthorized admin access',
                        reproductionSteps: [
                            `1. Open in browser (without logging in): ${baseOrigin}${path}`,
                            `2. Observe: the page loads successfully (HTTP 200)`,
                            `3. Admin functionality is accessible without authentication`,
                        ],
                    });
                }
            } catch (_) { }
        }

        return findings;
    }
}

module.exports = AccessControlAgent;
