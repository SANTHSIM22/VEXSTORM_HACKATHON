const { v4: uuidv4 } = require('uuid');

class ScanMemory {
    constructor(target, config) {
        this.target = target;
        this.scanId = uuidv4();
        this.config = config;
        this.attackSurface = {
            urls: [],
            forms: [],
            parameters: [],
            apiEndpoints: [],
            jsFiles: [],
            cookies: [],
            headers: {},
        };
        this.findings = [];
        this.logs = [];
        this.strategy = null;
        this.executionHistory = [];
        this.statistics = {
            startTime: new Date().toISOString(),
            endTime: null,
            totalEndpoints: 0,
            totalFindings: 0,
            agentsRun: [],
        };
    }

    updateAttackSurface(data) {
        for (const key of Object.keys(data)) {
            if (Array.isArray(this.attackSurface[key])) {
                const existing = new Set(this.attackSurface[key].map(i => JSON.stringify(i)));
                for (const item of data[key]) {
                    const str = JSON.stringify(item);
                    if (!existing.has(str)) {
                        this.attackSurface[key].push(item);
                        existing.add(str);
                    }
                }
            } else if (typeof this.attackSurface[key] === 'object') {
                Object.assign(this.attackSurface[key], data[key]);
            }
        }
        this.statistics.totalEndpoints = this.attackSurface.urls.length;
    }

    addFinding(finding) {
        this.findings.push(finding);
        this.statistics.totalFindings = this.findings.length;
    }

    setStrategy(strategy) {
        this.strategy = strategy;
    }

    addExecution(entry) {
        this.executionHistory.push({
            timestamp: new Date().toISOString(),
            ...entry,
        });
    }

    finalize() {
        this.statistics.endTime = new Date().toISOString();
    }

    snapshot() {
        return JSON.parse(JSON.stringify({
            target: this.target,
            scanId: this.scanId,
            config: this.config,
            attackSurface: this.attackSurface,
            findings: this.findings,
            strategy: this.strategy,
            statistics: this.statistics,
        }));
    }
}

module.exports = ScanMemory;
