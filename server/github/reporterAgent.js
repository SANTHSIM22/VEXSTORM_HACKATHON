'use strict';

/**
 * REPORTER AGENT — GitHub variant
 * Compiles all verified findings into JSON + HTML reports.
 * Uses extension's reportTools for rendering + server's Mistral client.
 */

const { Mistral } = require('@mistralai/mistralai');
const { buildReport, renderHtmlReport } = require('./tools/reportBuilder');

class ReporterAgent {
  constructor(apiKey, model, logger) {
    this.name   = 'ReporterAgent';
    this.logger = logger || console.log;
    this.client = new Mistral({ apiKey: apiKey || process.env.MISTRAL_API_KEY });
    this.model  = model || 'mistral-large-latest';
  }

  log(msg) { this.logger(`[ReporterAgent] ${msg}`); }

  async generateExecutiveSummary(report) {
    this.log('Generating executive summary...');
    const { summary, findings, meta } = report;

    const topFindings = (findings || [])
      .filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity))
      .slice(0, 8)
      .map((f) => `- [${f.severity}] ${f.category}: ${f.description} (${(f.file || '').split(/[\\/]/).pop()}:${f.line || '?'})`)
      .join('\n');

    const prompt = `You are a Senior Security Engineer. Write a concise executive summary for this GitHub repository security audit.

Repository: ${meta?.repoUrl || report.meta?.targetPath || 'Unknown'}
Language: ${meta?.language || 'Unknown'}
Total Findings: ${summary.totalFindings}
Risk Level: ${summary.riskLevel} (Score: ${summary.riskScore}/100)
Critical: ${summary.bySeverity?.CRITICAL || 0}, High: ${summary.bySeverity?.HIGH || 0}, Medium: ${summary.bySeverity?.MEDIUM || 0}

Top Critical/High Issues:
${topFindings || 'None found'}

Write:
1. Executive Summary (2-3 sentences)
2. Key Risk Areas (bullet points)
3. Immediate Actions Required (top 3 critical fixes)
4. Overall Security Posture Assessment

Keep it professional and actionable. Max 400 words.`;

    try {
      const response = await this.client.chat.complete({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a senior security engineer writing an audit report for executives.' },
          { role: 'user',   content: prompt },
        ],
        temperature: 0.2,
        maxTokens:   2048,
      });
      return response.choices[0]?.message?.content || 'Executive summary generation failed.';
    } catch (e) {
      this.log(`Executive summary error: ${e.message}`);
      return `Security scan of GitHub repository completed. Found ${summary.totalFindings} vulnerabilities with risk level: ${summary.riskLevel}.`;
    }
  }

  async run(verifierResults, scannerResult, allAgentLogs, options = {}) {
    const t0       = Date.now();
    this.log('Building final report...');

    const findings = verifierResults.verifiedFindings || [];

    const patternFindings  = findings.filter((f) => f.source === 'Pattern Scan');
    const secretFindings   = findings.filter((f) => f.source === 'Secret Scan');
    const astFindings      = findings.filter((f) => f.source === 'AST Scan');
    const depFindings      = findings.filter((f) => f.source === 'Dependency Audit');
    const llmFindings      = findings.filter((f) =>
      ['LLM Analysis', 'Cross-File Analysis'].includes(f.source) || !f.source
    );

    const authFindings     = options.authResults?.authFindings         || [];
    const bizFindings      = options.bizResults?.bizFindings           || [];
    const apiFindings      = options.apiResults?.apiFindings           || [];
    const frontendFindings = options.frontendResults?.frontendFindings || [];
    const infraFindings    = options.infraResults?.infraFindings       || [];
    const cryptoFindings   = options.cryptoResults?.cryptoFindings     || [];
    const loggingFindings  = options.cryptoResults?.loggingFindings    || [];

    // Target path — use repo URL as identifier
    const targetPath = scannerResult?.meta?.repoUrl || 'GitHub Repository';

    const reportJson = buildReport({
      targetPath,
      patternFindings,
      secretFindings,
      astFindings,
      depFindings,
      llmFindings,
      authFindings,
      bizFindings,
      apiFindings,
      frontendFindings,
      infraFindings,
      cryptoFindings,
      loggingFindings,
      agentLogs:   allAgentLogs || [],
      scanDurationMs: Date.now() - t0,
    });

    // Inject GitHub metadata into report
    if (scannerResult?.meta) {
      reportJson.meta = { ...reportJson.meta, ...scannerResult.meta };
    }

    const executiveSummary     = await this.generateExecutiveSummary(reportJson);
    reportJson.executiveSummary = executiveSummary;

    this.log('Rendering HTML report...');
    const htmlReport = renderHtmlReport(reportJson);

    const elapsed = Date.now() - t0;
    this.log(`Report generation done in ${elapsed}ms`);

    return { reportJson, htmlReport, executiveSummary, stats: { durationMs: elapsed } };
  }
}

module.exports = ReporterAgent;
