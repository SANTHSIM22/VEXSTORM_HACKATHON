const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');
const cheerio = require('cheerio');

class IntegrityAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('IntegrityAgent', 'A08 - Software & Data Integrity Failures', logger, memory, findingsStore);
    }

    async execute(target) {
        const findings = [];
        const { urls, jsFiles } = this.memory.attackSurface;

        // 1. Scan HTML for SRI and Secrets
        for (const url of urls.slice(0, 15)) {
            try {
                const response = await makeRequest(url);
                const body = typeof response.data === 'string' ? response.data : '';
                if (!body) continue;

                const $ = cheerio.load(body);

                await this._scanHTMLForSecrets($, url);

                // Check for external scripts without SRI
                $('script[src]').each((_, el) => {
                    const src = $(el).attr('src') || '';
                    const integrity = $(el).attr('integrity');
                    const crossorigin = $(el).attr('crossorigin');

                    if (this._isExternalResource(src, target) && !integrity) {
                        const snippet = $.html(el);
                        this.addFinding({
                            type: 'Missing SRI',
                            endpoint: url,
                            parameter: src,
                            description: `External script loaded without Subresource Integrity (SRI)`,
                            evidence: `Insecure tag: ${snippet}`,
                            confidenceScore: 0.9,
                            exploitScenario: 'If the CDN is compromised, malicious code is executed on all users\' browsers',
                            impact: 'Supply chain attack, arbitrary code execution in user browsers',
                            reproductionSteps: [
                                `1. Run: curl -s "${url}" | grep "${src}"`,
                                `2. Observe the script tag lacks an "integrity" attribute.`
                            ],
                        });
                    }
                });

                // Check for external stylesheets without SRI
                $('link[rel="stylesheet"][href]').each((_, el) => {
                    const href = $(el).attr('href') || '';
                    const integrity = $(el).attr('integrity');

                    if (this._isExternalResource(href, target) && !integrity) {
                        this.addFinding({
                            type: 'Missing SRI',
                            endpoint: url,
                            parameter: href,
                            description: `External stylesheet loaded without SRI`,
                            evidence: `<link href="${href}"> missing integrity attribute`,
                            confidenceScore: 0.7,
                            exploitScenario: 'Compromised CDN can inject CSS-based attacks',
                            impact: 'Data exfiltration via CSS, UI manipulation',
                            reproductionSteps: [
                                `1. Navigate to ${url} in a browser.`,
                                `2. View the page source (Ctrl+U).`,
                                `3. Find: <link href="${href}">`,
                                `4. Observe that the "integrity" attribute is missing.`
                            ],
                        });
                    }
                });

                // Check for unsafe deserialization/injection patterns in inline scripts
                const scriptContent = $('script:not([src])').text();
                const unsafePatterns = [
                    { pattern: /eval\s*\(/g, type: 'eval()' },
                    { pattern: /new\s+Function\s*\(/g, type: 'new Function()' },
                    { pattern: /document\.write\s*\(/g, type: 'document.write()' },
                    { pattern: /innerHTML\s*=/g, type: 'innerHTML assignment' },
                    { pattern: /JSON\.parse\(.*\.substring/g, type: 'unsafe JSON parsing' },
                    { pattern: /deserialize\(|unserialize\(/i, type: 'deserialization function' }
                ];

                for (const { pattern, type } of unsafePatterns) {
                    if (pattern.test(scriptContent)) {
                        this.addFinding({
                            type: 'Insecure JavaScript Pattern',
                            endpoint: url,
                            parameter: type,
                            description: `Potentially unsafe JavaScript pattern: ${type}`,
                            evidence: `${type} found in inline script on ${url}`,
                            confidenceScore: 0.5,
                            exploitScenario: `${type} can be exploited if user-controlled data reaches it`,
                            impact: 'DOM XSS or client-side injection',
                            reproductionSteps: [
                                `1. Open view-source:${url}`,
                                `2. Search for "${type}"`,
                                `3. Trace data flow to see if it accepts unsanitized user input`,
                            ],
                        });
                    }
                }

                // Check for JWTs in the body or localStorage-like snippets
                const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
                const matches = body.match(jwtPattern);
                if (matches) {
                    for (const jwt of matches) {
                        this._analyzeJWT(jwt, url);
                    }
                }

            } catch (_) { }
        }

        // 5. Secrets in JS Scanning
        for (const jsUrl of jsFiles.slice(0, 30)) {
            await this._scanJSForSecrets(jsUrl);
        }

        return findings;
    }

    async _scanJSForSecrets(url) {
        try {
            const res = await makeRequest(url);
            const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
            this._findSecrets(content, url, 'JavaScript file');
        } catch (_) { }
    }

    async _scanHTMLForSecrets($, url) {
        // Scan scripts
        $('script:not([src])').each((_, el) => {
            this._findSecrets($(el).text(), url, 'inline script');
        });

        // Scan comments
        const html = $.html();
        const commentPattern = /<!--([\s\S]*?)-->/g;
        let match;
        while ((match = commentPattern.exec(html)) !== null) {
            this._findSecrets(match[1], url, 'HTML comment');
        }
    }

    _findSecrets(content, url, source) {
        const secretPatterns = [
            { name: 'Generic API Key', pattern: /[a-zA-Z0-9]{32,}/g },
            { name: 'Firebase API Key', pattern: /AIza[0-9A-Za-z-_]{35}/g },
            { name: 'Stripe API Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g },
            { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
            { name: 'AWS Secret Key', pattern: /['"][a-zA-Z0-9/+=]{40}['"]/g },
            { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
            { name: 'Google OAuth Client ID', pattern: /[0-9]{12}-[a-zA-Z0-9]{32}\.apps\.googleusercontent\.com/g },
            { name: 'Hardcoded Credential', pattern: /(password|passwd|secret|token|cred|auth|key)\s*[:=]\s*['"][^'"]+['"]/gi },
            { name: 'Internal File Path', pattern: /([a-zA-Z]:\\[\w\s.-]+|(\/[a-zA-Z0-9._-]+){3,})/g },
            { name: 'Private Key', pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g },
            { name: 'SSH Key', pattern: /ssh-rsa\s+[A-Za-z0-9+/=]+/g }
        ];

        for (const { name, pattern } of secretPatterns) {
            const matches = content.match(pattern);
            if (matches) {
                // Avoid noisy false positives for very generic keys by checking entropy/context if needed
                // For now, only report if it doesn't look like common UI noise
                for (const match of matches.slice(0, 3)) {
                    if (match.length < 8) continue;

                    this.addFinding({
                        type: 'Information Disclosure (Secrets)',
                        endpoint: url,
                        parameter: name,
                        description: `Sensitive ${name} discovered in ${source}`,
                        evidence: `Source: ${source}. Match: ${match.substring(0, 4)}...${match.substring(match.length - 4)}`,
                        confidenceScore: 0.7,
                        impact: 'Potential unauthorized access to infrastructure or user data',
                        reproductionSteps: [`Inspect the ${source} at ${url} for ${name} patterns`]
                    });
                }
            }
        }
    }

    _analyzeJWT(jwt, url) {
        try {
            const parts = jwt.split('.');
            if (parts.length !== 3) return;

            const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

            if (header.alg === 'none') {
                this.addFinding({
                    type: 'Insecure JWT Configuration',
                    endpoint: url,
                    parameter: 'JWT Algorithm',
                    description: 'JWT using "none" algorithm discovered',
                    evidence: `Alg: none, Header: ${JSON.stringify(header)}`,
                    confidenceScore: 0.95,
                    exploitScenario: 'Attacker can forge tokens by setting alg to none and removing the signature',
                    impact: 'Complete authentication bypass',
                    reproductionSteps: [
                        `1. Capture a JWT from the application: ${jwt.substring(0, 20)}...`,
                        `2. Decode the header and change "alg" to "none"`,
                        `3. Remove the signature part (third part) and keep the trailing dot`,
                        `4. Send the forged token to the server`,
                    ],
                });
            } else if (header.alg === 'HS256') {
                this.addFinding({
                    type: 'Weak Cryptographic Algorithm',
                    endpoint: url,
                    parameter: 'JWT Algorithm',
                    description: 'JWT using symmetric HS256 algorithm',
                    evidence: `Alg: HS256 in use`,
                    confidenceScore: 0.6,
                    exploitScenario: 'Symmetric signing (HS256) is vulnerable to key brute forcing if a weak secret is used',
                    impact: 'Potential token forgery if secret is cracked',
                    reproductionSteps: [
                        `1. Extract the JWT from the page`,
                        `2. Use a tool like hashcat or jwt-cracker to attempt to brute-force the HS256 secret`,
                    ],
                });
            }
        } catch (_) { }
    }

    _isExternalResource(src, baseUrl) {
        try {
            const { URL } = require('url');
            const srcOrigin = new URL(src, baseUrl).origin;
            const baseOrigin = new URL(baseUrl).origin;
            return srcOrigin !== baseOrigin;
        } catch {
            return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//');
        }
    }
}

module.exports = IntegrityAgent;
