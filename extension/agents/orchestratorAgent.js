// @ts-nocheck
/**
 * ORCHESTRATOR AGENT — LangGraph StateGraph
 *
 * This is the brain of the multi-agent system.
 * Uses LangGraph's StateGraph to coordinate all agents in a pipeline:
 *
 *   START
 *     │
 *     ▼
 *  [scannerNode]         — ScannerAgent: discover + read all files
 *     │
 *     ▼
 *  [patternNode]         — PatternAnalysisAgent: regex + AST + secret + dep scan
 *     │
 *     ▼
 *  [llmAnalyzerNode]     — LLMAnalyzerAgent: deep Mistral analysis
 *     │
 *     ▼
 *  [verifierNode]        — VerifierAgent: dedup + enrich + LLM verify
 *     │
 *     ▼
 *  [reporterNode]        — ReporterAgent: build JSON + HTML report
 *     │
 *     ▼
 *   END
 *
 * State is passed between nodes as an immutable object (LangGraph channels).
 */

'use strict';

const { StateGraph, END, START } = require('@langchain/langgraph');
const { Annotation }              = require('@langchain/langgraph');

const ScannerAgent         = require('./scannerAgent');
const PatternAnalysisAgent = require('./patternAnalysisAgent');
const LLMAnalyzerAgent     = require('./llmAnalyzerAgent');
const VerifierAgent        = require('./verifierAgent');
const ReporterAgent        = require('./reporterAgent');
const AuthSecurityAgent    = require('./authSecurityAgent');
const BusinessLogicAgent   = require('./businessLogicAgent');
const ApiSecurityAgent     = require('./apiSecurityAgent');
const FrontendSecurityAgent = require('./frontendSecurityAgent');
const InfrastructureAgent  = require('./infrastructureAgent');
const CryptoLoggingAgent   = require('./cryptoLoggingAgent');

// ─── State definition using LangGraph Annotation ─────────────────────────────
const SecurityScanState = Annotation.Root({
  // Input
  targetPath:      Annotation({ reducer: (_, y) => y }),
  apiKey:          Annotation({ reducer: (_, y) => y }),
  model:           Annotation({ reducer: (_, y) => y }),
  options:         Annotation({ reducer: (_, y) => y ?? {} }),

  // Pipeline state
  status:          Annotation({ reducer: (_, y) => y, default: () => 'idle' }),

  // Agent outputs
  scannerResult:   Annotation({ reducer: (_, y) => y, default: () => null }),
  patternResults:  Annotation({ reducer: (_, y) => y, default: () => null }),
  llmResults:      Annotation({ reducer: (_, y) => y, default: () => null }),
  verifierResults: Annotation({ reducer: (_, y) => y, default: () => null }),
  reportResults:   Annotation({ reducer: (_, y) => y, default: () => null }),

  // Specialist agent outputs
  authResults:     Annotation({ reducer: (_, y) => y, default: () => null }),
  bizResults:      Annotation({ reducer: (_, y) => y, default: () => null }),
  apiResults:      Annotation({ reducer: (_, y) => y, default: () => null }),
  frontendResults: Annotation({ reducer: (_, y) => y, default: () => null }),
  infraResults:    Annotation({ reducer: (_, y) => y, default: () => null }),
  cryptoResults:   Annotation({ reducer: (_, y) => y, default: () => null }),

  // Accumulated logs from all agents
  agentLogs: Annotation({
    reducer: (existing, newLogs) => [...(existing || []), ...(newLogs || [])],
    default: () => [],
  }),

  // Error tracking
  errors: Annotation({
    reducer: (existing, newErrs) => [...(existing || []), ...(newErrs || [])],
    default: () => [],
  }),

  // Progress callback (not serialized, just passed through)
  onProgress: Annotation({ reducer: (_, y) => y, default: () => null }),
});

// ─── Build the orchestrator graph ─────────────────────────────────────────────
function buildOrchestratorGraph() {
  const graph = new StateGraph(SecurityScanState);

  // ── Node 1: Scanner ────────────────────────────────────────────────────────
  graph.addNode('scanner', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Scanning Files', message: msg });
    };

    try {
      const agent = new ScannerAgent(logger);
      const result = await agent.run(state.targetPath, state.options || {});
      logger(`Scanner complete: ${result.stats.totalFiles} files found`);

      return {
        scannerResult: result,
        status: 'scanning_complete',
        agentLogs: logs,
      };
    } catch (e) {
      logs.push(`[ERROR] Scanner failed: ${e.message}`);
      return { status: 'scanner_error', agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 2: Pattern Analysis ───────────────────────────────────────────────
  graph.addNode('patternAnalysis', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Pattern Analysis', message: msg });
    };

    try {
      const agent = new PatternAnalysisAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(
        `Pattern analysis complete: ${result.stats.patternFindings} pattern, ` +
        `${result.stats.secretFindings} secret, ${result.stats.astFindings} AST, ` +
        `${result.stats.depFindings} dependency findings`
      );

      return {
        patternResults: result,
        status: 'pattern_complete',
        agentLogs: logs,
      };
    } catch (e) {
      logs.push(`[ERROR] Pattern analysis failed: ${e.message}`);
      return {
        patternResults: { patternFindings: [], secretFindings: [], astFindings: [], depFindings: [] },
        status: 'pattern_error',
        agentLogs: logs,
        errors: [e.message],
      };
    }
  });

  // ── Node 3a: Auth Security ─────────────────────────────────────────────────
  graph.addNode('authNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Auth Analysis', message: msg });
    };
    try {
      const agent = new AuthSecurityAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`Auth analysis done: ${result.stats?.findingsCount || 0} findings`);
      return { authResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] Auth analysis failed: ${e.message}`);
      return { authResults: { authFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 3b: Business Logic ────────────────────────────────────────────────
  graph.addNode('bizNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Business Logic Analysis', message: msg });
    };
    try {
      const agent = new BusinessLogicAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`Business logic done: ${result.stats?.findingsCount || 0} findings`);
      return { bizResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] Business logic failed: ${e.message}`);
      return { bizResults: { bizFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 3c: API Security ─────────────────────────────────────────────────
  graph.addNode('apiNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'API Security Analysis', message: msg });
    };
    try {
      const agent = new ApiSecurityAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`API security done: ${result.stats?.findingsCount || 0} findings`);
      return { apiResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] API security failed: ${e.message}`);
      return { apiResults: { apiFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 3d: Frontend Security ────────────────────────────────────────────
  graph.addNode('frontendNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Frontend Security Analysis', message: msg });
    };
    try {
      const agent = new FrontendSecurityAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`Frontend security done: ${result.stats?.findingsCount || 0} findings`);
      return { frontendResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] Frontend security failed: ${e.message}`);
      return { frontendResults: { frontendFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 3e: Infrastructure ────────────────────────────────────────────────
  graph.addNode('infraNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Infrastructure Analysis', message: msg });
    };
    try {
      const agent = new InfrastructureAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`Infrastructure done: ${result.stats?.findingsCount || 0} findings`);
      return { infraResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] Infrastructure analysis failed: ${e.message}`);
      return { infraResults: { infraFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 3f: Crypto & Logging ─────────────────────────────────────────────
  graph.addNode('cryptoNode', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Crypto & Logging Analysis', message: msg });
    };
    try {
      const agent = new CryptoLoggingAgent(logger);
      const result = await agent.run(state.scannerResult);
      logger(`Crypto/Logging done: ${(result.stats?.cryptoFindings || 0) + (result.stats?.loggingFindings || 0)} findings`);
      return { cryptoResults: result, agentLogs: logs };
    } catch (e) {
      logs.push(`[ERROR] Crypto/logging analysis failed: ${e.message}`);
      return { cryptoResults: { cryptoFindings: [], loggingFindings: [] }, agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 4: LLM Analyzer ───────────────────────────────────────────────────
  graph.addNode('llmAnalyzer', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'AI Analysis', message: msg });
    };

    try {
      const agent = new LLMAnalyzerAgent(
        state.apiKey,
        state.model,
        logger
      );

      const result = await agent.run(
        state.scannerResult,
        state.patternResults,
        {
          maxFiles: state.options?.maxFilesForLlm || 25,
          onProgress: (p) => state.onProgress?.({ ...p, stage: 'AI Analysis' }),
        }
      );

      logger(`LLM analysis complete: ${result.stats.findings} findings from ${result.stats.filesAnalyzed} files`);

      return {
        llmResults: result,
        status: 'llm_complete',
        agentLogs: logs,
      };
    } catch (e) {
      logs.push(`[ERROR] LLM analysis failed: ${e.message}`);
      return {
        llmResults: { llmFindings: [] },
        status: 'llm_error',
        agentLogs: logs,
        errors: [e.message],
      };
    }
  });

  // ── Node 4: Verifier ───────────────────────────────────────────────────────
  graph.addNode('verifier', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Verifying Findings', message: msg });
    };

    try {
      const agent = new VerifierAgent(state.apiKey, state.model, logger);
      const result = await agent.run(
        state.patternResults,
        state.llmResults,
        state.scannerResult
      );

      logger(
        `Verification complete: ${result.stats.total} unique findings — ` +
        `${result.stats.critical} CRITICAL, ${result.stats.high} HIGH, ${result.stats.medium} MEDIUM`
      );

      return {
        verifierResults: result,
        status: 'verification_complete',
        agentLogs: logs,
      };
    } catch (e) {
      logs.push(`[ERROR] Verification failed: ${e.message}`);
      return { status: 'verifier_error', agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Node 5: Reporter ───────────────────────────────────────────────────────
  graph.addNode('reporter', async (state) => {
    const logs = [];
    const logger = (msg) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      state.onProgress?.({ stage: 'Generating Report', message: msg });
    };

    try {
      const agent = new ReporterAgent(state.apiKey, state.model, logger);
      const result = await agent.run(
        state.verifierResults,
        state.scannerResult,
        state.agentLogs,
        {
          outputDir:       state.options?.outputDir,
          authResults:     state.authResults,
          bizResults:      state.bizResults,
          apiResults:      state.apiResults,
          frontendResults: state.frontendResults,
          infraResults:    state.infraResults,
          cryptoResults:   state.cryptoResults,
        }
      );

      logger('Report generation complete');

      return {
        reportResults: result,
        status: 'complete',
        agentLogs: logs,
      };
    } catch (e) {
      logs.push(`[ERROR] Report generation failed: ${e.message}`);
      return { status: 'reporter_error', agentLogs: logs, errors: [e.message] };
    }
  });

  // ── Edges ──────────────────────────────────────────────────────────────────
  graph.addEdge(START, 'scanner');
  graph.addEdge('scanner', 'patternAnalysis');
  graph.addEdge('patternAnalysis', 'authNode');
  graph.addEdge('authNode', 'bizNode');
  graph.addEdge('bizNode', 'apiNode');
  graph.addEdge('apiNode', 'frontendNode');
  graph.addEdge('frontendNode', 'infraNode');
  graph.addEdge('infraNode', 'cryptoNode');
  graph.addEdge('cryptoNode', 'llmAnalyzer');
  graph.addEdge('llmAnalyzer', 'verifier');
  graph.addEdge('verifier', 'reporter');
  graph.addEdge('reporter', END);

  return graph.compile();
}

// ─── Main exported function ───────────────────────────────────────────────────
/**
 * Run the full multi-agent security scan.
 *
 * @param {object} config
 * @param {string} config.targetPath - Directory to scan
 * @param {string} config.apiKey     - Mistral API key
 * @param {string} config.model      - Mistral model name
 * @param {object} config.options    - Additional scan options
 * @param {function} config.onProgress - Progress callback ({ stage, message, current, total })
 * @returns {Promise<ScanResult>}
 */
async function runSecurityScan(config) {
  const { targetPath, apiKey, model, options = {}, onProgress } = config;

  if (!targetPath) throw new Error('targetPath is required');
  if (!apiKey)     throw new Error('Mistral API key is required. Set it in VS Code settings: zerotrace.mistralApiKey');

  const app = buildOrchestratorGraph();

  const initialState = {
    targetPath,
    apiKey,
    model: model || 'mistral-large-latest',
    options,
    onProgress: onProgress || (() => {}),
    status: 'starting',
    agentLogs: [],
    errors: [],
  };

  onProgress?.({ stage: 'Starting', message: `Initializing security scan of ${targetPath}` });

  const finalState = await app.invoke(initialState);

  return {
    status:          finalState.status,
    reportJson:      finalState.reportResults?.reportJson,
    htmlReport:      finalState.reportResults?.htmlReport,
    executiveSummary: finalState.reportResults?.executiveSummary,
    jsonPath:        finalState.reportResults?.jsonPath,
    htmlPath:        finalState.reportResults?.htmlPath,
    agentLogs:       finalState.agentLogs,
    errors:          finalState.errors,
    stats: {
      scanner:   finalState.scannerResult?.stats,
      pattern:   finalState.patternResults?.stats,
      llm:       finalState.llmResults?.stats,
      verifier:  finalState.verifierResults?.stats,
      auth:      finalState.authResults?.stats,
      biz:       finalState.bizResults?.stats,
      api:       finalState.apiResults?.stats,
      frontend:  finalState.frontendResults?.stats,
      infra:     finalState.infraResults?.stats,
      crypto:    finalState.cryptoResults?.stats,
    },
  };
}

module.exports = { runSecurityScan, buildOrchestratorGraph };
