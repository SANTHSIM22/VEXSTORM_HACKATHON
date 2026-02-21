const cheerio = require('cheerio');
const { URL } = require('url');
const { makeRequest } = require('../utils/httpClient');

class Crawler {
    constructor(logger, maxDepth = 3) {
        this.logger = logger;
        this.maxDepth = maxDepth;
        this.visited = new Set();
        this.results = {
            urls: [],
            forms: [],
            parameters: [],
            apiEndpoints: [],
            jsFiles: [],
        };
    }

    async crawl(baseUrl, depth = 0) {
        if (depth > this.maxDepth) return this.results;

        const normalizedUrl = this._normalizeUrl(baseUrl);
        if (this.visited.has(normalizedUrl)) return this.results;
        this.visited.add(normalizedUrl);

        this.logger.info(`[Crawler] Crawling: ${normalizedUrl} (depth: ${depth})`);

        try {
            const response = await makeRequest(normalizedUrl);
            const body = typeof response.data === 'string' ? response.data : '';

            if (!body || !response.headers['content-type']?.includes('text/html')) {
                return this.results;
            }

            this.results.urls.push(normalizedUrl);
            const $ = cheerio.load(body);
            const baseOrigin = new URL(normalizedUrl).origin;

            // Extract forms
            $('form').each((_, form) => {
                const $form = $(form);
                const formData = {
                    action: this._resolveUrl($form.attr('action') || '', normalizedUrl),
                    method: ($form.attr('method') || 'GET').toUpperCase(),
                    inputs: [],
                };
                $form.find('input, textarea, select').each((__, input) => {
                    const $input = $(input);
                    formData.inputs.push({
                        name: $input.attr('name') || '',
                        type: $input.attr('type') || 'text',
                        value: $input.attr('value') || '',
                    });
                });
                if (formData.inputs.length > 0) {
                    this.results.forms.push(formData);
                }
            });

            // Extract links
            const links = new Set();
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const resolved = this._resolveUrl(href, normalizedUrl);
                    if (resolved && resolved.startsWith(baseOrigin)) {
                        links.add(resolved);
                    }
                }
            });

            // Extract query parameters (including SPA hash parameters)
            for (const url of [normalizedUrl, ...links]) {
                try {
                    const parsed = new URL(url);
                    // Standard params
                    for (const [key] of parsed.searchParams) {
                        this.results.parameters.push({ url, param: key });
                    }
                    // SPA/Hash params
                    if (parsed.hash && parsed.hash.includes('?')) {
                        const hashQuery = parsed.hash.split('?')[1];
                        const hashParams = new URLSearchParams(hashQuery);
                        for (const [key] of hashParams) {
                            this.results.parameters.push({ url, param: key });
                        }
                    }
                } catch (_) { }
            }

            // Extract API endpoints and routes from scripts
            const scriptContents = [$('script:not([src])').text()];

            // Extract and queue JS files for content extraction
            $('script[src]').each((_, el) => {
                const src = $(el).attr('src');
                if (src) {
                    const resolvedJs = this._resolveUrl(src, normalizedUrl);
                    if (resolvedJs) {
                        this.results.jsFiles.push(resolvedJs);
                        if (resolvedJs.startsWith(baseOrigin) && !this.visited.has(resolvedJs)) {
                            this.visited.add(resolvedJs);
                            // We do a synchronous-looking await here for simplicity but it's okay because we limit depth 
                            // Or better, we collect promises as we did not want to block overly
                        }
                    }
                }
            });

            // For same-origin JS files we haven't processed, fetch them
            const jsToFetch = this.results.jsFiles.filter(url => url.startsWith(baseOrigin));
            for (const jsUrl of jsToFetch) {
                if (!this.visited.has(jsUrl + '_content')) {
                    this.visited.add(jsUrl + '_content');
                    try {
                        const jsRes = await makeRequest(jsUrl);
                        if (typeof jsRes.data === 'string') {
                            scriptContents.push(jsRes.data);
                        }
                    } catch (e) {
                        // Ignore fetching errors for JS
                    }
                }
            }

            const apiPatterns = [
                /['"`](\/api\/[^'"`\s]+)['"`]/g,
                /['"`](\/rest\/[^'"`\s]+)['"`]/g,
                /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g,
                /axios\.\w+\s*\(\s*['"`]([^'"`]+)['"`]/g,
                /XMLHttpRequest.*open\s*\(\s*['"`]\w+['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
            ];

            const spaRoutePatterns = [
                /path\s*:\s*['"]([^'"]+)['"]/g,
            ];

            for (const content of scriptContents) {
                for (const pattern of apiPatterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        this.results.apiEndpoints.push(this._resolveUrl(match[1], normalizedUrl));
                    }
                }
                for (const pattern of spaRoutePatterns) {
                    let match;
                    while ((match = pattern.exec(content)) !== null) {
                        const route = match[1];
                        if (route && !route.includes('*') && !route.includes(':')) {
                            // Construct SPA route with hash fragment assuming common SPA framework routing
                            const spaUrl = this._resolveUrl('/#/' + route, baseOrigin);
                            if (spaUrl) links.add(spaUrl);
                        }
                    }
                }
            }

            // Recursively crawl discovered links
            const crawlPromises = [];
            for (const link of links) {
                if (!this.visited.has(this._normalizeUrl(link))) {
                    crawlPromises.push(this.crawl(link, depth + 1));
                }
            }

            if (crawlPromises.length > 0) {
                await Promise.allSettled(crawlPromises.slice(0, 20)); // Limit concurrent crawls
            }

        } catch (err) {
            this.logger.warn(`[Crawler] Failed to crawl ${normalizedUrl}: ${err.message}`);
        }

        return this.results;
    }

    _normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            // DO NOT strip hash as SPAs use it for routing
            return parsed.toString().replace(/\/+$/, '');
        } catch {
            return url;
        }
    }

    _resolveUrl(href, base) {
        try {
            return new URL(href, base).toString();
        } catch {
            return null;
        }
    }
}

module.exports = Crawler;
