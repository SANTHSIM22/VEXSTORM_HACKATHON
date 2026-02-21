const { v4: uuidv4 } = require('uuid');

class FindingsStore {
    constructor() {
        this.findings = [];
    }

    add(finding) {
        const entry = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            ...finding,
        };
        // Deduplication: same type + endpoint + parameter
        const exists = this.findings.some(
            f => f.type === entry.type && f.endpoint === entry.endpoint && f.parameter === entry.parameter
        );
        if (!exists) {
            this.findings.push(entry);
        }
        return entry;
    }

    all() {
        return [...this.findings];
    }

    bySeverity(severity) {
        return this.findings.filter(f => f.severity === severity);
    }

    byOwasp(owaspCategory) {
        return this.findings.filter(f => f.owaspCategory === owaspCategory);
    }

    count() {
        return this.findings.length;
    }

    toJSON() {
        return this.findings;
    }
}

module.exports = FindingsStore;
