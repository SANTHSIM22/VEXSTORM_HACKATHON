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
      const filePath = path.join(outputDir, 'vulentry-report.json');
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
      const filePath = path.join(outputDir, 'vulentry-report.html');
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

    // Build structured JSON report
    const reportJson = JSON.parse(await buildReportTool.invoke({
      targetPath:      scannerResult ? scannerResult.allFiles?.[0]?.filePath?.split(/[\\/]test[\\/]/)[0] || 'Unknown' : 'Unknown',
      patternFindings,
      secretFindings,
      astFindings,
      depFindings,
      llmFindings,
      agentLogs: allAgentLogs,
      scanDurationMs: Date.now() - t0,
    }));

    // Generate executive summary
    const executiveSummary = await this.generateExecutiveSummary(reportJson);
    reportJson.executiveSummary = executiveSummary;

    // Render HTML
    this.log('Rendering HTML report...');
    let htmlReport = await renderHtmlReportTool.invoke({ report: reportJson });

    // Inject executive summary into HTML
    htmlReport = htmlReport.replace(
      '<div class="container">',
      `<div class="container">
  <div class="section" style="margin-bottom:28px">
    <div class="section-header"><h2>📝 Executive Summary</h2></div>
    <div style="padding:20px;line-height:1.8;white-space:pre-wrap;font-size:14px;color:#374151">${executiveSummary}</div>
  </div>`
    );

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
