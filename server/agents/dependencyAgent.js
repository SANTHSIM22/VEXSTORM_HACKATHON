const BaseAgent = require('./baseAgent');
const { makeRequest } = require('../utils/httpClient');

class DependencyAgent extends BaseAgent {
    constructor(logger, memory, findingsStore) {
        super('DependencyAgent', 'A06 - Vulnerable Components', logger, memory, findingsStore);
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
                        this.addFinding({
                            type: 'Vulnerable Component',
                            endpoint: jsFile,
                            parameter: lib.name,
                            description: `${lib.name} v${version} - ${lib.description}`,
                            evidence: `Detected via filename: ${jsFile}`,
                            confidenceScore: 0.8,
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
                            this.addFinding({
                                type: 'Vulnerable Component',
                                endpoint: url,
                                parameter: lib.name,
                                description: `${lib.name} v${version} detected in page - ${lib.description}`,
                                evidence: `Pattern matched in response body`,
                                confidenceScore: 0.7,
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
