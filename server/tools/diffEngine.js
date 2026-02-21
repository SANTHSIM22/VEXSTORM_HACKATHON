class DiffEngine {
    diff(response1, response2) {
        const body1 = typeof response1.data === 'string' ? response1.data : JSON.stringify(response1.data || '');
        const body2 = typeof response2.data === 'string' ? response2.data : JSON.stringify(response2.data || '');

        return {
            statusDiff: response1.status !== response2.status ? { from: response1.status, to: response2.status } : null,
            headerDiff: this._diffHeaders(response1.headers, response2.headers),
            bodyLengthDiff: body2.length - body1.length,
            bodyChanged: body1 !== body2,
            timingDiff: (response2.timingMs || 0) - (response1.timingMs || 0),
            significantChange: this._isSignificant(response1, response2, body1, body2),
        };
    }

    _diffHeaders(h1, h2) {
        const changes = [];
        const keys = new Set([...Object.keys(h1 || {}), ...Object.keys(h2 || {})]);
        for (const key of keys) {
            if ((h1 || {})[key] !== (h2 || {})[key]) {
                changes.push({ header: key, from: (h1 || {})[key], to: (h2 || {})[key] });
            }
        }
        return changes;
    }

    _isSignificant(r1, r2, b1, b2) {
        if (r1.status !== r2.status) return true;
        const lengthRatio = b1.length > 0 ? Math.abs(b2.length - b1.length) / b1.length : 0;
        if (lengthRatio > 0.1) return true;
        if (Math.abs((r2.timingMs || 0) - (r1.timingMs || 0)) > 3000) return true;
        return false;
    }
}

module.exports = DiffEngine;
