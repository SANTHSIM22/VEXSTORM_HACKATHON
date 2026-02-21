class BaseAgent {
    constructor(name, owaspCategory, logger, memory, findingsStore) {
        this.name = name;
        this.owaspCategory = owaspCategory;
        this.logger = logger;
        this.memory = memory;
        this.findingsStore = findingsStore;
    }

    async run(target) {
        this.logger.info(`[${this.name}] Starting scan on ${target}`);
        try {
            const results = await this.execute(target);
            this.logger.info(`[${this.name}] Completed. Found ${results?.length || 0} issue(s).`);
            this.memory.addExecution({ agent: this.name, status: 'completed', findingsCount: results?.length || 0 });
            return results || [];
        } catch (err) {
            this.logger.error(`[${this.name}] Error: ${err.message}`);
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
        this.logger.warn(`[${this.name}] FINDING: ${finding.type} at ${finding.endpoint}`);
    }
}

module.exports = BaseAgent;
