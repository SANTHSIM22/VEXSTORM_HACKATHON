const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class DependencyAgent extends BaseAgent {
    constructor(logger, memory, findingsStore, registryRef = null) {
        super('DependencyAgent', 'A06 - Vulnerable Components', logger, memory, findingsStore, registryRef);
    }

    /**
     * Calculates confidence for vulnerable component findings based on detection signals.
     * @param {object} factors
     * @param {string}  factors.source - 'filename' | 'pageBody' – where the version was detected
     * @param {boolean} factors.exactVersionMatch - Whether an exact vulnerable version was matched (not just prefix)
     * @param {boolean} factors.hasCVE - Whether there's a known CVE for this version
     * @param {number}  factors.vulnVersionPrefixMatches - How many prefix patterns matched the detected version
     * @returns {number} Confidence score between 0.1 and 1.0
     */
    _calculateConfidence({ source = 'filename', exactVersionMatch = false, hasCVE = false, vulnVersionPrefixMatches = 0 }) {
        let score = 0.25; // base

        // Detection source reliability
        if (source === 'filename') score += 0.2;       // filename is a strong signal
        else if (source === 'pageBody') score += 0.1;  // page body is noisier

        // Version match quality
        if (exactVersionMatch) score += 0.2;
        else if (vulnVersionPrefixMatches > 0) score += Math.min(vulnVersionPrefixMatches * 0.08, 0.16);

        // CVE existence
        if (hasCVE) score += 0.2;

        return Math.max(0.1, Math.min(1.0, parseFloat(score.toFixed(2))));
    }

    async execute(target) {
        const findings = [];
        const { jsFiles, urls } = this.memory.attackSurface;

        this.logger.info(`[DependencyAgent] Analyzing ${jsFiles.length} JS files for vulnerable components`);

        // Known vulnerable library signatures (mock vulnerability DB)
        const vulnDB = [
            { name: 'jQuery', pattern: /jquery[\/.-]?([\d.]+)/i, vulnVersions: ['1.', '2.'], description: 'jQuery < 3.0 has XSS vulnerabilities (CVE-2020-11022)' },
            { name: 'Angular', pattern: /angular[\/.-]?([\d.]+)/i, vulnVersions: ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5'], description: 'AngularJS 1.x has known sandbox escape vulnerabilities' },
            { name: 'Bootstrap', pattern: /bootstrap[\/.-]?([\d.]+)/i, vulnVersions: ['2.', '3.0', '3.1', '3.2', '3.3'], description: 'Bootstrap < 3.4.0 has XSS vulnerabilities' },
            { name: 'Lodash', pattern: /lodash[\/.-]?([\d.]+)/i, vulnVersions: ['4.17.0', '4.17.1', '4.17.2', '4.17.3', '4.17.4'], description: 'Lodash < 4.17.5 has prototype pollution (CVE-2018-16487)' },
            { name: 'Moment.js', pattern: /moment[\/.-]?([\d.]+)/i, vulnVersions: ['2.'], description: 'Moment.js has ReDoS vulnerabilities and is deprecated' },
            { name: 'React', pattern: /react[\/.-]?([\d.]+)/i, vulnVersions: ['0.', '15.'], description: 'Older React versions have XSS vulnerabilities' },
        ];

        // Check JS file URLs for version patterns
        for (const jsFile of jsFiles) {
            for (const lib of vulnDB) {
                const match = jsFile.match(lib.pattern);
                if (match) {
                    const version = match[1] || 'unknown';
                    const isVuln = lib.vulnVersions.some(v => version.startsWith(v));
                    if (isVuln) {
                        const matchedPrefixes = lib.vulnVersions.filter(v => version.startsWith(v));
                        this.addFinding({
                            type: 'Vulnerable Component',
                            endpoint: jsFile,
                            parameter: lib.name,
                            description: `${lib.name} v${version} - ${lib.description}`,
                            evidence: `Detected via filename: ${jsFile}`,
                            confidenceScore: this._calculateConfidence({ source: 'filename', exactVersionMatch: lib.vulnVersions.includes(version), hasCVE: /CVE/.test(lib.description), vulnVersionPrefixMatches: matchedPrefixes.length }),
                            exploitScenario: `Attacker exploits known vulnerability in ${lib.name} ${version}`,
                            impact: 'Depends on specific vulnerability—may include XSS, RCE, or data compromise',
                            reproductionSteps: [
                                `1. Open a browser or run: curl -s "${jsFile}" | head -n 5`,
                                `2. Inspect the file content or filename.`,
                                `3. Observe the vulnerable version number ${version} for ${lib.name}.`
                            ],
                        });
                    }
                }
            }
        }

        // Check inline scripts on pages for library versions
        for (const url of urls.slice(0, 10)) {
            try {
                const response = await makeRequest(url);
                const body = typeof response.data === 'string' ? response.data : '';

                for (const lib of vulnDB) {
                    const match = body.match(lib.pattern);
                    if (match) {
                        const version = match[1] || 'unknown';
                        const isVuln = lib.vulnVersions.some(v => version.startsWith(v));
                        if (isVuln) {
                            const matchedPrefixes = lib.vulnVersions.filter(v => version.startsWith(v));
                            this.addFinding({
                                type: 'Vulnerable Component',
                                endpoint: url,
                                parameter: lib.name,
                                description: `${lib.name} v${version} detected in page - ${lib.description}`,
                                evidence: `Pattern matched in response body`,
                                confidenceScore: this._calculateConfidence({ source: 'pageBody', exactVersionMatch: lib.vulnVersions.includes(version), hasCVE: /CVE/.test(lib.description), vulnVersionPrefixMatches: matchedPrefixes.length }),
                                exploitScenario: `Known vulnerabilities in ${lib.name} ${version} can be exploited`,
                                impact: 'Varies per CVE—XSS, prototype pollution, or DoS',
                                reproductionSteps: [
                                    `1. Navigate to ${url} in a browser.`,
                                    `2. View the page source (Ctrl+U) or inspect the DOM.`,
                                    `3. Search for "${lib.name}" and observe the outdated version ${version} being loaded.`
                                ],
                            });
                        }
                    }
                }
            } catch (_) { }
        }

        return findings;
    }
}

module.exports = DependencyAgent;
