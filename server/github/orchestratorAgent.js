'use strict';

/**
 * GITHUB ORCHESTRATOR AGENT
 * Sequential pipeline that mirrors the extension's LangGraph orchestrator
 * but runs directly in the Node.js server without LangGraph dependency.
 *
 * Pipeline:
 *   GitHub Repo
 *     ↓ ScannerAgent (fetch files via GitHub API)
 *     ↓ PatternAnalysisAgent (regex + AST + secret + dep)
 *     ↓ LLMAnalyzerAgent (Mistral deep analysis)
 *     ↓ VerifierAgent (dedup + enrich + LLM verify)
 *     ↓ ReporterAgent (JSON + HTML report)
 */

const GithubScannerAgent  = require('./scannerAgent');
const PatternAnalysisAgent = require('./patternAnalysisAgent');
const LLMAnalyzerAgent     = require('./llmAnalyzerAgent');
const VerifierAgent        = require('./verifierAgent');
const ReporterAgent        = require('./reporterAgent');

/**
 * Run a full GitHub security scan.
 *
 * @param {object} config
 * @param {string}   config.repoUrl      - GitHub repository URL
 * @param {string}   [config.branch]     - Branch to scan (defaults to repo default)
 * @param {string}   [config.token]      - GitHub PAT for private repos
 * @param {string}   config.apiKey       - Mistral API key
 * @param {string}   [config.model]      - Mistral model
 * @param {function} [config.onProgress] - Progress callback({ stage, message })
 * @returns {Promise<object>}
 */
async function runGithubSecurityScan(config) {
  const { repoUrl, branch, token, apiKey, model, onProgress } = config;
  if (!repoUrl)  throw new Error('repoUrl is required');
  if (!apiKey)   throw new Error('Mistral API key is required');

  const progress = (stage, message) => onProgress?.({ stage, message });
  const agentLogs = [];
  const errors    = [];
  const log       = (msg) => {
    agentLogs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[GithubOrchestrator] ${msg}`);
  };

  progress('Starting', `Initializing GitHub scan of ${repoUrl}`);

  // ── Step 1: Fetch files from GitHub ───────────────────────────────────────
  progress('Fetching Files', 'Downloading repository file tree from GitHub API...');
  let scannerResult;
  try {
    const scanner = new GithubScannerAgent((msg) => { log(msg); progress('Fetching Files', msg); });
    scannerResult = await scanner.run(repoUrl, { branch, token });
    log(`Scanner complete: ${scannerResult.stats.totalFiles} files fetched`);
  } catch (e) {
    errors.push(e.message);
    throw new Error(`Scanner failed: ${e.message}`);
  }

  // ── Step 2: Pattern Analysis ───────────────────────────────────────────────
  progress('Pattern Analysis', 'Running OWASP pattern scan, secret detection, AST analysis...');
  let patternResults;
  try {
    const agent    = new PatternAnalysisAgent((msg) => { log(msg); progress('Pattern Analysis', msg); });
    patternResults = await agent.run(scannerResult);
    log(`Pattern analysis done: ${patternResults.stats.patternFindings} pattern, ${patternResults.stats.secretFindings} secret findings`);
  } catch (e) {
    errors.push(e.message);
    log(`[ERROR] Pattern analysis failed: ${e.message}`);
    patternResults = { patternFindings: [], secretFindings: [], astFindings: [], depFindings: [] };
  }

  // ── Step 3: LLM Deep Analysis ─────────────────────────────────────────────
  progress('AI Analysis', 'Running Mistral AI deep vulnerability analysis...');
  let llmResults;
  try {
    const agent  = new LLMAnalyzerAgent(apiKey, model, (msg) => { log(msg); progress('AI Analysis', msg); });
    llmResults   = await agent.run(scannerResult, patternResults, { maxFiles: 20 });
    log(`LLM analysis done: ${llmResults.stats.findings} AI findings`);
  } catch (e) {
    errors.push(e.message);
    log(`[ERROR] LLM analysis failed: ${e.message}`);
    llmResults = { llmFindings: [] };
  }

  // ── Step 4: Verify & Enrich ────────────────────────────────────────────────
  progress('Verifying', 'Deduplicating, enriching, and verifying findings...');
  let verifierResults;
  try {
    const agent      = new VerifierAgent(apiKey, model, (msg) => { log(msg); progress('Verifying', msg); });
    verifierResults  = await agent.run(patternResults, llmResults, scannerResult);
    log(`Verification done: ${verifierResults.stats.total} unique findings`);
  } catch (e) {
    errors.push(e.message);
    log(`[ERROR] Verification failed: ${e.message}`);
    verifierResults = { verifiedFindings: [], stats: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } };
  }

  // ── Step 5: Generate Report ────────────────────────────────────────────────
  progress('Generating Report', 'Building HTML security report...');
  let reportResults;
  try {
    const agent    = new ReporterAgent(apiKey, model, (msg) => { log(msg); progress('Generating Report', msg); });
    reportResults  = await agent.run(verifierResults, scannerResult, agentLogs, {});
    log('Report generation complete');
  } catch (e) {
    errors.push(e.message);
    log(`[ERROR] Report generation failed: ${e.message}`);
    reportResults = { reportJson: null, htmlReport: null, executiveSummary: null };
  }

  progress('Complete', 'GitHub security scan finished!');

  return {
    status:           errors.length > 0 ? (reportResults?.reportJson ? 'completed_with_errors' : 'failed') : 'completed',
    repoUrl,
    reportJson:       reportResults?.reportJson,
    htmlReport:       reportResults?.htmlReport,
    executiveSummary: reportResults?.executiveSummary,
    agentLogs,
    errors,
    stats: {
      scanner:  scannerResult.stats,
      pattern:  patternResults.stats,
      llm:      llmResults.stats,
      verifier: verifierResults.stats,
    },
  };
}

module.exports = { runGithubSecurityScan };
