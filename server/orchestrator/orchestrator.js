const AgentRegistry = require('./agentRegistry');
const RiskEngine = require('../engine/riskEngine');

class Orchestrator {
    constructor(logger, memory, findingsStore, registryRef = null) {
        this.logger = logger;
        this.memory = memory;
        this.findingsStore = findingsStore;
        this.registry = new AgentRegistry(logger, memory, findingsStore);
        this.riskEngine = new RiskEngine();
        this.registryRef = registryRef;
        this.state = 'idle'; // idle, recon, planning, scanning, remediation, reporting, done
    }

    _updateRegistry(msg, agent = 'ORCHESTRATOR') {
        if (!this.registryRef) return;
        this.registryRef.logs.push({
            time: new Date().toISOString(),
            agent,
            msg,
        });
    }

    async run(target) {
        this.logger.info('=== ORCHESTRATOR: Starting Agentic Scan ===');
        this.logger.info(`Target: ${target}`);

        try {
            // Phase 1: Reconnaissance
            this.state = 'recon';
            this.logger.info('\n--- Phase 1: Reconnaissance ---');
            this._updateRegistry('Phase 1: Reconnaissance — Mapping attack surface...');
            const reconAgent = this.registry.get('recon');
            await reconAgent.run(target);
            this.memory.statistics.agentsRun.push('recon');

            const surface = this.memory.attackSurface;
            this.logger.info(`Attack surface: ${surface.urls.length} URLs, ${surface.forms.length} forms, ${surface.parameters.length} parameters, ${surface.jsFiles.length} JS files`);
            this._updateRegistry(`Recon complete: ${surface.urls.length} URLs, ${surface.forms.length} forms, ${surface.parameters.length} params discovered`);

            // Phase 2: Planning
            this.state = 'planning';
            this.logger.info('\n--- Phase 2: AI-Powered Planning ---');
            this._updateRegistry('Phase 2: AI-Powered Planning — Analyzing attack vectors...');
            const plannerAgent = this.registry.get('planner');
            await plannerAgent.run(target);
            this.memory.statistics.agentsRun.push('planner');
            this._updateRegistry('Strategy generated. Starting vulnerability scan...');

            // Phase 3: Vulnerability Scanning
            this.state = 'scanning';
            this.logger.info('\n--- Phase 3: Vulnerability Scanning ---');
            this._updateRegistry('Phase 3: Vulnerability Scanning — Deploying agents...');

            // Always run all vulnerability agents in deterministic order
            // LLM strategy is used for logging/context but not for agent selection
            const vulnAgents = ['injection', 'xss', 'config', 'auth', 'accessControl', 'ssrf', 'pathTraversal', 'crypto', 'dependency', 'integrity', 'logging', 'businessLogic'];

            const strategy = this.memory.strategy;
            if (strategy?.reasoning) {
                this.logger.info(`LLM Strategy Reasoning: ${strategy.reasoning}`);
            }

            for (const agentName of vulnAgents) {
                const agent = this.registry.get(agentName);
                if (agent) {
                    this.logger.info(`\n>> Executing: ${agentName}`);
                    this._updateRegistry(`Executing ${agentName} agent...`, agentName);
                    await agent.run(target);
                    this.memory.statistics.agentsRun.push(agentName);
                }
            }

            // Phase 4: Risk Scoring
            this.logger.info('\n--- Phase 4: Risk Scoring ---');
            this._updateRegistry('Phase 4: Risk Scoring — Calculating severity...');
            const findings = this.findingsStore.all();
            for (const finding of findings) {
                const enriched = this.riskEngine.enrichFinding(finding);
                Object.assign(finding, enriched);
            }

            // Phase 5: Remediation
            this.state = 'remediation';
            this.logger.info('\n--- Phase 5: AI-Powered Remediation ---');
            this._updateRegistry('Phase 5: AI-Powered Remediation — Generating fixes...');
            const remediationAgent = this.registry.get('remediation');
            await remediationAgent.run(target);
            this.memory.statistics.agentsRun.push('remediation');

            // Finalize
            this.state = 'done';
            this.memory.finalize();

            this.logger.info('\n=== ORCHESTRATOR: Scan Complete ===');
            this.logger.info(`Total findings: ${this.findingsStore.count()}`);
            this._updateRegistry(`Scan complete. ${this.findingsStore.count()} vulnerabilities identified.`);

            return this._buildReport(target);

        } catch (err) {
            this.logger.error(`Orchestrator error: ${err.message}`);
            this._updateRegistry(`Error: ${err.message}`, 'ERROR');
            this.state = 'done';
            this.memory.finalize();
            return this._buildReport(target);
        }
    }

    _buildReport(target) {
        const findings = this.findingsStore.all();
        const stats = this.memory.statistics;

        return {
            scanSummary: {
                target,
                scanId: this.memory.scanId,
                startTime: stats.startTime,
                endTime: stats.endTime,
                totalEndpoints: stats.totalEndpoints,
                totalFindings: findings.length,
                agentsRun: stats.agentsRun,
            },
            findings: findings.map(f => ({
                id: f.id,
                type: f.type,
                owaspCategory: f.owaspCategory,
                severity: f.severity || 'Medium',
                cvssScore: f.cvssScore || 0,
                confidenceScore: f.confidenceScore || 0,
                endpoint: f.endpoint,
                parameter: f.parameter,
                description: f.description,
                evidence: f.evidence,
                exploitScenario: f.exploitScenario,
                impact: f.impact,
                remediation: f.remediation || 'Review and apply security best practices.',
            })),
            statistics: {
                bySeverity: {
                    critical: findings.filter(f => f.severity === 'Critical').length,
                    high: findings.filter(f => f.severity === 'High').length,
                    medium: findings.filter(f => f.severity === 'Medium').length,
                    low: findings.filter(f => f.severity === 'Low').length,
                    info: findings.filter(f => f.severity === 'Info').length,
                },
                byOwasp: this._groupByOwasp(findings),
                totalEndpoints: stats.totalEndpoints,
                scanDuration: stats.endTime && stats.startTime
                    ? `${((new Date(stats.endTime) - new Date(stats.startTime)) / 1000).toFixed(1)}s`
                    : 'N/A',
            },
            recommendations: this._generateRecommendations(findings),
        };
    }

    _groupByOwasp(findings) {
        const groups = {};
        for (const f of findings) {
            const cat = f.owaspCategory || 'Unknown';
            groups[cat] = (groups[cat] || 0) + 1;
        }
        return groups;
    }

    _generateRecommendations(findings) {
        const recs = [];
        const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
        findings.forEach(f => { if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++; });

        if (severityCounts.Critical > 0) recs.push(`URGENT: ${severityCounts.Critical} critical vulnerabilities require immediate attention.`);
        if (severityCounts.High > 0) recs.push(`${severityCounts.High} high-severity issues should be resolved before deployment.`);
        if (findings.some(f => f.type === 'SQL Injection')) recs.push('Implement parameterized queries across all database interactions.');
        if (findings.some(f => f.type?.includes('XSS'))) recs.push('Implement output encoding and Content-Security-Policy headers.');
        if (findings.some(f => f.type === 'Missing Security Header')) recs.push('Add all recommended security headers (CSP, HSTS, X-Frame-Options, etc.).');
        if (findings.some(f => f.owaspCategory?.includes('A07'))) recs.push('Strengthen authentication mechanisms and session management.');

        if (recs.length === 0) recs.push('No major issues found. Continue regular security assessments.');

        return recs;
    }
}

module.exports = Orchestrator;
