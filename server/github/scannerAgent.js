'use strict';

/**
 * GITHUB SCANNER AGENT
 * Wraps githubFetcher to produce the same output format as the
 * extension's ScannerAgent, so all downstream agents work unchanged.
 */

const { fetchGithubRepo } = require('./githubFetcher');

class GithubScannerAgent {
  constructor(logger) {
    this.name   = 'GithubScannerAgent';
    this.logger = logger || console.log;
  }

  log(msg) { this.logger(`[GithubScannerAgent] ${msg}`); }

  /**
   * @param {string} repoUrl  - GitHub repo URL
   * @param {object} options  - { branch, token }
   * @returns {Promise<object>} - Same shape as extension ScannerAgent.run()
   */
  async run(repoUrl, options = {}) {
    this.log(`Starting GitHub scan: ${repoUrl}`);

    const result = await fetchGithubRepo(repoUrl, {
      branch:     options.branch,
      token:      options.token,
      onProgress: (msg) => this.log(msg),
    });

    this.log(`Scan complete: ${result.stats.totalFiles} files in ${result.stats.durationMs}ms`);
    return result;
  }
}

module.exports = GithubScannerAgent;
