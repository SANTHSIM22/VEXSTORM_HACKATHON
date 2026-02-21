class ValidationEngine {
    constructor(logger) {
        this.logger = logger;
    }

    captureBaseline(response) {
        return {
            status: response.status,
            bodyLength: (typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '')).length,
            headers: { ...response.headers },
            timingMs: response.timingMs || 0,
            bodyHash: this._simpleHash(typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '')),
        };
    }

    compareResponses(baseline, testResponse) {
        const testBody = typeof testResponse.data === 'string' ? testResponse.data : JSON.stringify(testResponse.data || '');
        const result = {
            statusChanged: baseline.status !== testResponse.status,
            statusDelta: testResponse.status - baseline.status,
            bodyLengthDelta: testBody.length - baseline.bodyLength,
            bodyChanged: this._simpleHash(testBody) !== baseline.bodyHash,
            timingDelta: (testResponse.timingMs || 0) - baseline.timingMs,
            headerChanges: this._compareHeaders(baseline.headers, testResponse.headers),
        };
        result.anomalyScore = this._calculateAnomalyScore(result);
        return result;
    }

    detectReflection(payload, responseBody) {
        const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || '');
        const payloadStr = String(payload);
        const reflected = body.includes(payloadStr);
        const encodedReflection = body.includes(encodeURIComponent(payloadStr));
        return {
            reflected,
            encodedReflection,
            reflectionCount: reflected ? (body.split(payloadStr).length - 1) : 0,
        };
    }

    detectStackTrace(responseBody) {
        const body = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody || '');
        const patterns = [
            /at\s+\w+\s+\(.*:\d+:\d+\)/i,
            /Traceback\s+\(most recent call/i,
            /Exception in thread/i,
            /Fatal error:/i,
            /Stack trace:/i,
            /SQL syntax.*MySQL/i,
            /ORA-\d{5}/i,
            /PostgreSQL.*ERROR/i,
            /Microsoft.*ODBC.*SQL Server/i,
            /SQLITE_ERROR/i,
            /Uncaught\s+\w*Error/i,
            /Warning:.*\(\)/i,
            /on line \d+/i,
        ];
        const matches = patterns.filter(p => p.test(body));
        return {
            detected: matches.length > 0,
            patternCount: matches.length,
            patterns: matches.map(p => p.source),
        };
    }

    detectTimingAnomaly(baselineMs, testMs, threshold = 2.0) {
        const ratio = baselineMs > 0 ? testMs / baselineMs : 1;
        return {
            anomalous: ratio > threshold,
            ratio,
            baselineMs,
            testMs,
            deltaMs: testMs - baselineMs,
        };
    }

    calculateConfidence(anomalyScore, consistencyScore) {
        return Math.min(1.0, Math.max(0.0, (anomalyScore + consistencyScore) / 2));
    }

    _calculateAnomalyScore(comparison) {
        let score = 0;
        if (comparison.statusChanged) score += 0.3;
        if (Math.abs(comparison.bodyLengthDelta) > 100) score += 0.2;
        if (comparison.bodyChanged) score += 0.2;
        if (Math.abs(comparison.timingDelta) > 2000) score += 0.2;
        if (comparison.headerChanges.length > 0) score += 0.1;
        return Math.min(1.0, score);
    }

    _compareHeaders(baseHeaders, testHeaders) {
        const changes = [];
        const allKeys = new Set([...Object.keys(baseHeaders || {}), ...Object.keys(testHeaders || {})]);
        for (const key of allKeys) {
            const base = (baseHeaders || {})[key];
            const test = (testHeaders || {})[key];
            if (base !== test) {
                changes.push({ header: key, from: base || 'absent', to: test || 'absent' });
            }
        }
        return changes;
    }

    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return hash.toString(36);
    }
}

module.exports = ValidationEngine;
