/* ── Console colors for agent log output ── */
const AGENT_COLORS = {
    SYSTEM:        '\x1b[34m',
    ORCHESTRATOR:  '\x1b[35m',
    ERROR:         '\x1b[31m',
    recon:         '\x1b[36m',
    planner:       '\x1b[35m',
    injection:     '\x1b[31m',
    xss:           '\x1b[33m',
    auth:          '\x1b[33m',
    config:        '\x1b[32m',
    ssrf:          '\x1b[35m',
    accessControl: '\x1b[33m',
    pathTraversal: '\x1b[32m',
    crypto:        '\x1b[34m',
    dependency:    '\x1b[36m',
    integrity:     '\x1b[36m',
    logging:       '\x1b[90m',
    businessLogic: '\x1b[35m',
    remediation:   '\x1b[35m',
};
const RESET = '\x1b[0m';
const DIM   = '\x1b[90m';
const BOLD  = '\x1b[1m';

class BaseAgent {
    constructor(name, owaspCategory, logger, memory, findingsStore, registryRef = null) {
        this.name = name;
        this.owaspCategory = owaspCategory;
        this.logger = logger;
        this.memory = memory;
        this.findingsStore = findingsStore;
        this.registryRef = registryRef;
    }

    /** Push a live log entry to the scan registry (visible in dashboard + server console) */
    _pushLog(msg) {
        if (this.registryRef) {
            this.registryRef.logs.push({
                time: new Date().toISOString(),
                agent: this.name,
                msg,
            });
        }
        // Pretty-print to server console
        const color = AGENT_COLORS[this.name] || RESET;
        const ts = new Date().toLocaleTimeString();
        console.log(`${DIM}[${ts}]${RESET} ${color}${BOLD}[${this.name}]${RESET} ${msg}`);
    }

    async run(target) {
        this._pushLog(`Starting scan on ${target}`);
        try {
            const results = await this.execute(target);
            this._pushLog(`Completed. Found ${results?.length || 0} issue(s).`);
            this.memory.addExecution({ agent: this.name, status: 'completed', findingsCount: results?.length || 0 });
            return results || [];
        } catch (err) {
            this._pushLog(`Error: ${err.message}`);
            this.memory.addExecution({ agent: this.name, status: 'error', error: err.message });
            return [];
        }
    }

    async execute(target) {
        throw new Error(`${this.name}.execute() must be implemented`);
    }

    addFinding(finding) {
        const enriched = {
            owaspCategory: this.owaspCategory,
            ...finding,
        };
        this.findingsStore.add(enriched);
        this.memory.addFinding(enriched);
        const confidence = finding.confidenceScore;
        const manualTag = (confidence && confidence < 0.5) ? ' (Needs Manual Verification)' : '';
        this._pushLog(`FINDING: ${finding.type} at ${finding.endpoint} [${finding.severity || 'Medium'}]${manualTag}`);
    }
}

module.exports = BaseAgent;
