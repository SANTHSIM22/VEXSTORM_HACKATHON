const BaseAgent = require('./baseAgent');
const { planScanStrategy } = require('../llm/mistralClient');

class PlannerAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('PlannerAgent', 'Planning', logger, memory, findingsStore, registryRef);
    }

    async execute(target) {
        this.logger.info('[PlannerAgent] Creating scan strategy using Mistral LLM...');

        try {
            const strategy = await planScanStrategy(this.memory.attackSurface);
            this.memory.setStrategy(strategy);

            this.logger.info(`[PlannerAgent] Strategy created. Priority: ${JSON.stringify(strategy.priority)}`);
            this.logger.info(`[PlannerAgent] Reasoning: ${strategy.reasoning || 'N/A'}`);

            if (strategy.riskAreas && strategy.riskAreas.length > 0) {
                this.logger.info(`[PlannerAgent] High-risk areas: ${strategy.riskAreas.join(', ')}`);
            }

            return [];
        } catch (err) {
            this.logger.warn(`[PlannerAgent] LLM planning failed, using default strategy: ${err.message}`);
            const defaultStrategy = {
                priority: ['injection', 'xss', 'config', 'auth', 'accessControl', 'ssrf', 'crypto', 'dependency', 'integrity', 'logging'],
                reasoning: 'Default strategy: prioritize high-impact vulnerabilities first',
                riskAreas: [],
            };
            this.memory.setStrategy(defaultStrategy);
            return [];
        }
    }
}

module.exports = PlannerAgent;
