const ReconAgent = require('../agents/reconAgent');
const InjectionAgent = require('../agents/injectionAgent');
const XSSAgent = require('../agents/xssAgent');
const AuthAgent = require('../agents/authAgent');
const ConfigAgent = require('../agents/configAgent');
const SSRFAgent = require('../agents/ssrfAgent');
const DependencyAgent = require('../agents/dependencyAgent');
const AccessControlAgent = require('../agents/accessControlAgent');
const CryptoAgent = require('../agents/cryptoAgent');
const IntegrityAgent = require('../agents/integrityAgent');
const LoggingAgent = require('../agents/loggingAgent');
const PlannerAgent = require('../agents/plannerAgent');
const RemediationAgent = require('../agents/remediationAgent');
const BusinessLogicAgent = require('../agents/businessLogicAgent');
const PathTraversalAgent = require('../agents/pathTraversalAgent');

class AgentRegistry {
    constructor(logger, memory, findingsStore) {
        this.agents = {};
        this.logger = logger;
        this.memory = memory;
        this.findingsStore = findingsStore;

        this._registerDefaults();
    }

    _registerDefaults() {
        this.register('recon', new ReconAgent(this.logger, this.memory, this.findingsStore));
        this.register('planner', new PlannerAgent(this.logger, this.memory, this.findingsStore));
        this.register('injection', new InjectionAgent(this.logger, this.memory, this.findingsStore));
        this.register('xss', new XSSAgent(this.logger, this.memory, this.findingsStore));
        this.register('auth', new AuthAgent(this.logger, this.memory, this.findingsStore));
        this.register('config', new ConfigAgent(this.logger, this.memory, this.findingsStore));
        this.register('ssrf', new SSRFAgent(this.logger, this.memory, this.findingsStore));
        this.register('dependency', new DependencyAgent(this.logger, this.memory, this.findingsStore));
        this.register('accessControl', new AccessControlAgent(this.logger, this.memory, this.findingsStore));
        this.register('crypto', new CryptoAgent(this.logger, this.memory, this.findingsStore));
        this.register('integrity', new IntegrityAgent(this.logger, this.memory, this.findingsStore));
        this.register('logging', new LoggingAgent(this.logger, this.memory, this.findingsStore));
        this.register('businessLogic', new BusinessLogicAgent(this.logger, this.memory, this.findingsStore));
        this.register('pathTraversal', new PathTraversalAgent(this.logger, this.memory, this.findingsStore));
        this.register('remediation', new RemediationAgent(this.logger, this.memory, this.findingsStore));
    }

    register(name, agent) {
        this.agents[name] = agent;
    }

    get(name) {
        return this.agents[name];
    }

    getAll() {
        return { ...this.agents };
    }

    list() {
        return Object.keys(this.agents);
    }
}

module.exports = AgentRegistry;
