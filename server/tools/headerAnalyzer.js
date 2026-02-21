class HeaderAnalyzer {
    constructor() {
        this.securityHeaders = {
            'strict-transport-security': {
                name: 'HSTS',
                description: 'HTTP Strict Transport Security',
                recommendation: 'Add Strict-Transport-Security header with max-age of at least 31536000',
            },
            'content-security-policy': {
                name: 'CSP',
                description: 'Content Security Policy',
                recommendation: 'Implement a Content-Security-Policy header to prevent XSS and injection attacks',
            },
            'x-frame-options': {
                name: 'X-Frame-Options',
                description: 'Clickjacking protection',
                recommendation: 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking',
            },
            'x-content-type-options': {
                name: 'X-Content-Type-Options',
                description: 'MIME sniffing protection',
                recommendation: 'Add X-Content-Type-Options: nosniff',
            },
            'x-xss-protection': {
                name: 'X-XSS-Protection',
                description: 'XSS filter',
                recommendation: 'Add X-XSS-Protection: 1; mode=block',
            },
            'referrer-policy': {
                name: 'Referrer-Policy',
                description: 'Controls referrer information',
                recommendation: 'Add Referrer-Policy: strict-origin-when-cross-origin',
            },
            'permissions-policy': {
                name: 'Permissions-Policy',
                description: 'Controls browser features',
                recommendation: 'Add Permissions-Policy to restrict unnecessary browser features',
            },
            'cross-origin-embedder-policy': {
                name: 'COEP',
                description: 'Cross-Origin Embedder Policy',
                recommendation: 'Add Cross-Origin-Embedder-Policy: require-corp'
            },
            'cross-origin-opener-policy': {
                name: 'COOP',
                description: 'Cross-Origin Opener Policy',
                recommendation: 'Add Cross-Origin-Opener-Policy: same-origin'
            },
            'cross-origin-resource-policy': {
                name: 'CORP',
                description: 'Cross-Origin Resource Policy',
                recommendation: 'Add Cross-Origin-Resource-Policy: same-origin'
            },
            'x-permitted-cross-domain-policies': {
                name: 'X-Permitted-Cross-Domain-Policies',
                description: 'Restricts Flash/PDF cross-domain policy files',
                recommendation: 'Add X-Permitted-Cross-Domain-Policies: none'
            }
        };

        this.dangerousHeaders = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-runtime', 'x-version'];
    }

    analyze(headers) {
        const results = {
            missing: [],
            present: [],
            informationLeaks: [],
            corsIssues: [],
            cookieIssues: [],
        };

        // Check for missing security headers
        for (const [header, info] of Object.entries(this.securityHeaders)) {
            if (headers[header]) {
                results.present.push({ header, value: headers[header], ...info });
            } else {
                results.missing.push({ header, ...info });
            }
        }

        // Check for information leaking headers
        for (const header of this.dangerousHeaders) {
            if (headers[header]) {
                results.informationLeaks.push({
                    header,
                    value: headers[header],
                    recommendation: `Remove the ${header} header to prevent information disclosure`,
                });
            }
        }

        // Check CORS configuration
        const corsOrigin = headers['access-control-allow-origin'];
        if (corsOrigin === '*') {
            results.corsIssues.push({
                issue: 'Wildcard CORS origin',
                value: corsOrigin,
                severity: 'Medium',
                recommendation: 'Restrict Access-Control-Allow-Origin to specific trusted domains',
            });
        }

        const corsCredentials = headers['access-control-allow-credentials'];
        if (corsCredentials === 'true' && corsOrigin === '*') {
            results.corsIssues.push({
                issue: 'CORS with credentials and wildcard origin',
                value: `Origin: ${corsOrigin}, Credentials: ${corsCredentials}`,
                severity: 'High',
                recommendation: 'Never allow credentials with wildcard origin',
            });
        }

        // Check Set-Cookie headers
        const setCookie = headers['set-cookie'];
        if (setCookie) {
            const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
            for (const cookie of cookies) {
                const cookieLower = cookie.toLowerCase();
                if (!cookieLower.includes('httponly')) {
                    results.cookieIssues.push({ cookie: cookie.split('=')[0], issue: 'Missing HttpOnly flag' });
                }
                if (!cookieLower.includes('secure')) {
                    results.cookieIssues.push({ cookie: cookie.split('=')[0], issue: 'Missing Secure flag' });
                }
                if (!cookieLower.includes('samesite')) {
                    results.cookieIssues.push({ cookie: cookie.split('=')[0], issue: 'Missing SameSite attribute' });
                }
            }
        }

        return results;
    }
}

module.exports = HeaderAnalyzer;
