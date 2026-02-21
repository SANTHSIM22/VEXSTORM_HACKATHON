const BaseAgent = require('./baseAgent');
const { generateRemediation } = require('../llm/mistralClient');

class RemediationAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('RemediationAgent', 'Remediation', logger, memory, findingsStore);
    }

    async execute(target) {
        const findings = this.findingsStore.all();
        this.logger.info(`[RemediationAgent] Generating remediation for ${findings.length} findings...`);

        // Group by type and parameter to ensure distinct issues (like different security headers) get correct fixes
        const uniqueKeys = [...new Set(findings.map(f => `${f.type}|${f.parameter || 'N/A'}`))];

        for (const key of uniqueKeys) {
            const [type, parameter] = key.split('|');
            const typeFindings = findings.filter(fi => fi.type === type && (fi.parameter || 'N/A') === parameter);
            const finding = typeFindings[0];

            try {
                this.logger.info(`[RemediationAgent] Generating fix for: ${type} (${parameter})`);

                const techContext = {
                    jsFiles: (this.memory.attackSurface?.jsFiles || []).slice(0, 3),
                    serverHeaders: this.memory.attackSurface?.serverHeaders || 'Unknown',
                    inferredStack: this._inferStack()
                };

                const remediation = await generateRemediation(finding, techContext);

                for (const f of typeFindings) {
                    f.remediation = remediation;
                }
            } catch (err) {
                this.logger.warn(`[RemediationAgent] Failed to generate remediation for ${type}: ${err.message}`);
                for (const f of typeFindings) {
                    f.remediation = this._getFallbackRemediation(type);
                }
            }
        }

        return [];
    }

    _inferStack() {
        const jsFiles = (this.memory.attackSurface?.jsFiles || []).join(' ').toLowerCase();
        if (jsFiles.includes('angular')) return 'Angular (Client-side SPA)';
        if (jsFiles.includes('react')) return 'React (Client-side SPA)';
        if (jsFiles.includes('vue')) return 'Vue.js (Client-side SPA)';
        if (jsFiles.includes('jquery')) return 'jQuery-based legacy stack';
        return 'Modern Web Application (JS-heavy)';
    }

    _getFallbackRemediation(type) {
        const remediations = {
            'SQL Injection': 'Use parameterized queries/prepared statements. Never concatenate user input into SQL. Use an ORM like Sequelize or Knex.js.',
            'Reflected XSS': 'Encode all output. Use Content-Security-Policy header. Sanitize input with DOMPurify.',
            'XSS': 'Encode all output. Use Content-Security-Policy header. Sanitize input with DOMPurify.',
            'SSRF': 'Validate/whitelist URLs. Block internal IPs. Use URL parsing libraries.',
            'Path Traversal': 'Validate file paths. Use path.resolve() and check within allowed directory.',
            'IDOR': 'Implement proper authorization checks. Use indirect references.',
            'Broken Access Control': 'Implement role-based access control. Deny by default.',
            'Cryptographic Failure': 'Use HTTPS everywhere. Implement HSTS. Use strong TLS configuration.',
            'Security Misconfiguration': 'Remove debug endpoints. Set security headers. Follow hardening guides.',
            'Missing Security Header': 'Add recommended security headers: CSP, X-Frame-Options, HSTS, etc.',
            'CORS Misconfiguration': 'Restrict Access-Control-Allow-Origin to trusted domains only.',
            'Authentication Weakness': 'Use strong password policies. Implement MFA. Use secure session management.',
            'Session Weakness': 'Set HttpOnly, Secure, SameSite flags on cookies.',
            'JWT Weakness': 'Use RS256 algorithm. Validate all JWT claims. Set short expiration.',
            'Vulnerable Component': 'Update to latest versions. Monitor security advisories. Use npm audit.',
            'Missing SRI': 'Add integrity and crossorigin attributes to external script/link tags.',
            'Insecure Deserialization': 'Avoid eval/new Function. Use JSON.parse instead. Validate input.',
            'Logging Failure': 'Implement centralized logging. Monitor for anomalies. Hide error details in production.',
            'Information Disclosure': 'Remove verbose error messages. Disable directory listing. Remove server headers.',
            'Debug Endpoint': 'Disable debug endpoints in production. Restrict access to internal networks.',
        };
        return remediations[type] || 'Review and apply security best practices for this vulnerability type.';
    }
}

module.exports = RemediationAgent;
