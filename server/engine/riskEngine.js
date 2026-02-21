class RiskEngine {
    constructor() {
        this.severityMap = {
            critical: { min: 9.0, max: 10.0 },
            high: { min: 7.0, max: 8.9 },
            medium: { min: 4.0, max: 6.9 },
            low: { min: 0.1, max: 3.9 },
            info: { min: 0.0, max: 0.0 },
        };
    }

    calculateCVSS(finding) {
        const weights = {
            'SQL Injection': 9.8,
            'Command Injection': 9.8,
            'Reflected XSS': 6.1,
            'Stored XSS': 8.2,
            'XSS': 6.1,
            'SSRF': 8.6,
            'Broken Access Control': 8.2,
            'Path Traversal': 7.5,
            'IDOR': 6.5,
            'Cryptographic Failure': 7.5,
            'Security Misconfiguration': 5.3,
            'Missing Security Header': 4.0,
            'CORS Misconfiguration': 5.0,
            'Authentication Weakness': 7.5,
            'Session Weakness': 6.5,
            'JWT Weakness': 7.0,
            'Vulnerable Component': 6.0,
            'Insecure Deserialization': 8.1,
            'Missing SRI': 4.0,
            'Logging Failure': 3.0,
            'Information Disclosure': 5.3,
            'Debug Endpoint': 5.0,
        };

        const baseCvss = weights[finding.type] || 5.0;
        const confidenceFactor = finding.confidenceScore || 0.5;
        return Math.round(Math.min(10.0, baseCvss * (0.7 + 0.3 * confidenceFactor)) * 10) / 10;
    }

    determineSeverity(cvssScore) {
        if (cvssScore >= 9.0) return 'Critical';
        if (cvssScore >= 7.0) return 'High';
        if (cvssScore >= 4.0) return 'Medium';
        if (cvssScore >= 0.1) return 'Low';
        return 'Info';
    }

    enrichFinding(finding) {
        const cvssScore = this.calculateCVSS(finding);
        const severity = this.determineSeverity(cvssScore);
        return {
            ...finding,
            cvssScore,
            severity,
        };
    }
}

module.exports = RiskEngine;
