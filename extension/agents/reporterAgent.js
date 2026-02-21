/**
 * REPORTER AGENT
 * Responsibility: Compile all verified findings into a final structured report.
 * Uses Mistral to write an executive summary with risk assessment.
 * Outputs both JSON and HTML reports.
 */

'use strict';

const { ChatMistralAI }   = require('@langchain/mistralai');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { buildReportTool, renderHtmlReportTool } = require('../tools/reportTools');
const fs = require('fs');
const path = require('path');

class ReporterAgent {
  constructor(apiKey, model, logger) {
    this.name = 'ReporterAgent';
    this.logger = logger || console.log;

    this.llm = new ChatMistralAI({
      apiKey: apiKey,
      model: model || 'mistral-large-latest',
      temperature: 0.2,
      maxTokens: 2048,
    });
  }

  log(msg) {
    this.logger(`[ReporterAgent] ${msg}`);
  }

  /**
   * Generate executive summary using Mistral.
   */
  async generateExecutiveSummary(report) {
    this.log('Generating executive summary with Mistral...');

    const { summary, findings } = report;
    const topFindings = findings
      .filter((f) => ['CRITICAL', 'HIGH'].includes(f.severity))
      .slice(0, 8)
      .map((f) => `- [${f.severity}] ${f.category}: ${f.description} (${f.file?.split(/[\\/]/).pop()}:${f.line || '?'})`)
      .join('\n');

    const prompt = `You are a Senior Security Engineer. Write a concise executive summary for this security audit report.

Scan Target: ${report.meta.targetPath}
Total Findings: ${summary.totalFindings}
Risk Level: ${summary.riskLevel} (Score: ${summary.riskScore}/100)
Critical: ${summary.bySeverity.CRITICAL}, High: ${summary.bySeverity.HIGH}, Medium: ${summary.bySeverity.MEDIUM}

Top Critical/High Issues:
${topFindings || 'None found'}

Write:
1. Executive Summary (2-3 sentences)
2. Key Risk Areas (bullet points)
3. Immediate Actions Required (top 3 critical fixes)
4. Overall Security Posture Assessment

Keep it professional and actionable. Max 400 words.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage('You are a senior security engineer writing an audit report for executives.'),
        new HumanMessage(prompt),
      ]);
      return response.content || 'Executive summary generation failed.';
    } catch (e) {
      this.log(`Executive summary error: ${e.message}`);
      return `Security scan completed. Found ${summary.totalFindings} vulnerabilities with risk level: ${summary.riskLevel}.`;
    }
  }

  /**
   * Save JSON report to disk.
   */
  saveJsonReport(report, outputDir) {
    try {
      const filePath = path.join(outputDir, 'zerotrace-report.json');
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      this.log(`JSON report saved: ${filePath}`);
      return filePath;
    } catch (e) {
      this.log(`Failed to save JSON report: ${e.message}`);
      return null;
    }
  }

  /**
   * Save HTML report to disk.
   */
  saveHtmlReport(html, outputDir) {
    try {
      const filePath = path.join(outputDir, 'zerotrace-report.html');
      fs.writeFileSync(filePath, html, 'utf8');
      this.log(`HTML report saved: ${filePath}`);
      return filePath;
    } catch (e) {
      this.log(`Failed to save HTML report: ${e.message}`);
      return null;
    }
  }

  /**
   * Main entry point.
   */
  async run(verifierResults, scannerResult, allAgentLogs, options = {}) {
    const t0 = Date.now();
    this.log('Building final report...');

    const findings = verifierResults.verifiedFindings || [];

    // Separate by source
    const patternFindings = findings.filter((f) => f.source === 'Pattern Scan');
    const secretFindings  = findings.filter((f) => f.source === 'Secret Scan');
    const astFindings     = findings.filter((f) => f.source === 'AST Scan');
    const depFindings     = findings.filter((f) => f.source === 'Dependency Audit');
    const llmFindings     = findings.filter((f) =>
      ['LLM Analysis', 'Cross-File Analysis'].includes(f.source) ||
      (!f.source) // untagged LLM findings
    );

    // Pull specialist agent findings
    const authFindings     = options.authResults?.authFindings     || [];
    const bizFindings      = options.bizResults?.bizFindings       || [];
    const apiFindings      = options.apiResults?.apiFindings       || [];
    const frontendFindings = options.frontendResults?.frontendFindings || [];
    const infraFindings    = options.infraResults?.infraFindings   || [];
    const cryptoFindings   = options.cryptoResults?.cryptoFindings  || [];
    const loggingFindings  = options.cryptoResults?.loggingFindings || [];

    // Build structured JSON report
    const reportJson = JSON.parse(await buildReportTool.invoke({
      targetPath:      scannerResult ? scannerResult.allFiles?.[0]?.filePath?.split(/[\\/]test[\\/]/)[0] || 'Unknown' : 'Unknown',
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
      agentLogs: allAgentLogs,
      scanDurationMs: Date.now() - t0,
    }));

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(reportJson);
    reportJson.executiveSummary = executiveSummary;

    // Render HTML (executive summary is embedded by renderHtmlReportTool via r.executiveSummary)
    this.log('Rendering HTML report...');
    const htmlReport = await renderHtmlReportTool.invoke({ report: reportJson });

    // Save reports if output dir provided
    let jsonPath = null;
    let htmlPath = null;
    if (options.outputDir) {
      jsonPath = this.saveJsonReport(reportJson, options.outputDir);
      htmlPath = this.saveHtmlReport(htmlReport, options.outputDir);
    }

    const elapsed = Date.now() - t0;
    this.log(`Report generation done in ${elapsed}ms`);

    return {
      reportJson,
      htmlReport,
      executiveSummary,
      jsonPath,
      htmlPath,
      stats: { durationMs: elapsed },
    };
  }
}

module.exports = ReporterAgent;
