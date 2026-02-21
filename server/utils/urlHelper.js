const { URL } = require('url');

/**
 * Appends a parameter to a URL while correctly handling hash fragments (SPAs).
 * Example: /#/search?q=test -> appendParam(url, 'q', 'payload') -> /#/search?q=payload
 */
function appendParam(url, name, value) {
    try {
        const parsed = new URL(url);
        const hash = parsed.hash;

        if (hash && hash.includes('?')) {
            // Case: /#/search?q=test
            const [path, query] = hash.split('?');
            const searchParams = new URLSearchParams(query);
            searchParams.set(name, value);
            parsed.hash = `${path}?${searchParams.toString()}`;
            return parsed.toString();
        } else if (hash) {
            // Case: /#/search -> /#/search?q=payload
            parsed.hash = `${hash}${hash.includes('?') ? '&' : '?'}${name}=${encodeURIComponent(value)}`;
            return parsed.toString();
        } else {
            // Standard URL: /search?q=test
            parsed.searchParams.set(name, value);
            return parsed.toString();
        }
    } catch (e) {
        // Fallback for relative or malformed URLs
        if (url.includes('#')) {
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}${name}=${encodeURIComponent(value)}`;
        }
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${name}=${encodeURIComponent(value)}`;
    }
}

/**
 * Extracts all parameters from a URL including those inside a hash fragment.
 */
function extractParams(url) {
    const params = new Set();
    try {
        const parsed = new URL(url);
        // Standard params
        for (const [key] of parsed.searchParams) {
            params.add(key);
        }
        // Hash params
        const hash = parsed.hash;
        if (hash && hash.includes('?')) {
            const query = hash.split('?')[1];
            const searchParams = new URLSearchParams(query);
            for (const [key] of searchParams) {
                params.add(key);
            }
        }
    } catch (e) { }
    return Array.from(params);
}

module.exports = { appendParam, extractParams };
