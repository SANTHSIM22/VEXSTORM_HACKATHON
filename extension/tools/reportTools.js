/**
 * REPORT GENERATOR TOOLS
 * Compiles all findings from all agents into a structured
 * JSON report and renders it as an HTML document for the VS Code webview.
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

// ─── Severity ordering ────────────────────────────────────────────────────────
const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

function sevColor(sev) {
  return { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#2563eb', INFO: '#6b7280' }[sev] || '#6b7280';
}
function sevBg(sev) {
  return { CRITICAL: '#fef2f2', HIGH: '#fff7ed', MEDIUM: '#fffbeb', LOW: '#eff6ff', INFO: '#f9fafb' }[sev] || '#f9fafb';
}

// ─── Tool 1: Build structured JSON report ─────────────────────────────────────
const buildReportTool = new DynamicStructuredTool({
  name: 'build_report',
  description:
    'Consolidate all vulnerability findings from pattern scan, secret scan, AST scan, ' +
    'dependency audit, and LLM analysis into a single structured JSON report.',
  schema: z.object({
    targetPath:       z.string().describe('The scanned directory path'),
    patternFindings:  z.array(z.any()).optional().default([]),
    secretFindings:   z.array(z.any()).optional().default([]),
    astFindings:      z.array(z.any()).optional().default([]),
    depFindings:      z.array(z.any()).optional().default([]),
    llmFindings:      z.array(z.any()).optional().default([]),
    agentLogs:        z.array(z.string()).optional().default([]),
    scanDurationMs:   z.number().optional().default(0),
  }),
  func: async ({
    targetPath, patternFindings, secretFindings, astFindings,
    depFindings, llmFindings, agentLogs, scanDurationMs,
  }) => {
    const allFindings = [
      ...patternFindings.map((f) => ({ ...f, source: 'Pattern Scan' })),
      ...secretFindings.map( (f) => ({ ...f, source: 'Secret Scan'  })),
      ...astFindings.map(    (f) => ({ ...f, source: 'AST Scan'     })),
      ...depFindings.map(    (f) => ({ ...f, source: 'Dependency Audit' })),
      ...llmFindings.map(    (f) => ({ ...f, source: 'LLM Analysis' })),
    ];

    // Deduplicate by file + line + ruleId
    const seen = new Set();
    const unique = allFindings.filter((f) => {
      const key = `${f.file || ''}:${f.line || 0}:${f.ruleId || f.description || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by severity
    unique.sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));

    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    const byCategory = {};
    const byFile = {};

    for (const f of unique) {
      const sev = f.severity || 'INFO';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;

      const cat = f.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      const file = f.file || 'unknown';
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(f);
    }

    const riskScore = Math.min(
      100,
      bySeverity.CRITICAL * 25 + bySeverity.HIGH * 10 +
      bySeverity.MEDIUM * 3 + bySeverity.LOW * 1
    );

    const riskLevel =
      riskScore >= 75 ? 'CRITICAL' :
      riskScore >= 50 ? 'HIGH'     :
      riskScore >= 25 ? 'MEDIUM'   : 'LOW';

    const report = {
      meta: {
        targetPath,
        generatedAt: new Date().toISOString(),
        scanDurationMs,
        scanner: 'Vulentry — Multi-Agent Security Scanner',
        model: 'Mistral AI (LangGraph Orchestration)',
      },
      summary: {
        totalFindings: unique.length,
        riskScore,
        riskLevel,
        bySeverity,
        byCategory,
        topVulnerableFiles: Object.entries(byFile)
          .sort(([, a], [, b]) => b.length - a.length)
          .slice(0, 10)
          .map(([file, findings]) => ({ file, count: findings.length })),
      },
      findings: unique,
      byFile,
      agentLogs,
    };

    return JSON.stringify(report);
  },
});

// ─── Tool 2: Render HTML report ────────────────────────────────────────────────
const renderHtmlReportTool = new DynamicStructuredTool({
  name: 'render_html_report',
  description: 'Convert a structured JSON vulnerability report into a rich HTML document for display.',
  schema: z.object({
    report: z.any().describe('The JSON report object from build_report tool'),
  }),
  func: async ({ report }) => {
    const r = typeof report === 'string' ? JSON.parse(report) : report;
    const { meta, summary, findings, agentLogs } = r;

    const severityBadge = (sev) =>
      `<span style="background:${sevColor(sev)};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${sev}</span>`;

    const findingRows = findings.map((f, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:10px 12px">${severityBadge(f.severity || 'INFO')}</td>
        <td style="padding:10px 12px;font-weight:600;color:#1e293b">${escHtml(f.category || f.name || 'Unknown')}</td>
        <td style="padding:10px 12px;font-size:13px;color:#374151;max-width:320px">${escHtml(f.description || '')}</td>
        <td style="padding:10px 12px;font-size:12px;color:#6b7280;word-break:break-all">${escHtml((f.file || '').split(/[\\/]/).slice(-2).join('/'))}</td>
        <td style="padding:10px 12px;color:#6b7280;font-size:13px">${f.line || '—'}</td>
        <td style="padding:10px 12px"><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:11px;max-width:200px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((f.snippet || f.match || '').slice(0, 80))}</code></td>
        <td style="padding:10px 12px;font-size:12px;color:#9333ea">${escHtml(f.cwe || '—')}</td>
        <td style="padding:10px 12px;font-size:12px;color:#2563eb">${escHtml(f.owasp || '—')}</td>
        <td style="padding:10px 12px;font-size:11px;color:#6b7280">${escHtml(f.source || '—')}</td>
      </tr>`).join('');

    const catRows = Object.entries(summary.byCategory || {})
      .sort(([, a], [, b]) => b - a)
      .map(([cat, count]) =>
        `<tr><td style="padding:8px 12px">${escHtml(cat)}</td><td style="padding:8px 12px;text-align:center;font-weight:700">${count}</td></tr>`
      ).join('');

    const logHtml = (agentLogs || []).map((l) =>
      `<div style="padding:4px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#94a3b8">${escHtml(l)}</div>`
    ).join('');

    const riskColor = sevColor(summary.riskLevel);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Vulentry Security Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8fafc; color:#1e293b; }
    .header { background: linear-gradient(135deg,#0f172a 0%,#1e293b 100%); color:#fff; padding:32px 40px; }
    .header h1 { font-size:28px; font-weight:800; letter-spacing:-0.5px; }
    .header p  { color:#94a3b8; margin-top:6px; font-size:14px; }
    .container { max-width:1400px; margin:0 auto; padding:32px 40px; }
    .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:32px; }
    .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,.08); }
    .card .label { font-size:12px; color:#6b7280; text-transform:uppercase; letter-spacing:.5px; }
    .card .value { font-size:32px; font-weight:800; margin-top:4px; }
    .section { background:#fff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,.08); margin-bottom:28px; overflow:hidden; }
    .section-header { padding:18px 24px; border-bottom:1px solid #f1f5f9; }
    .section-header h2 { font-size:16px; font-weight:700; color:#0f172a; }
    table { width:100%; border-collapse:collapse; }
    th { padding:12px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#6b7280; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .risk-badge { display:inline-block; background:${riskColor}; color:#fff; padding:6px 16px; border-radius:20px; font-weight:800; font-size:16px; }
    .log-box { background:#0f172a; border-radius:8px; padding:16px; max-height:300px; overflow-y:auto; }
    .progress-bar { height:8px; border-radius:4px; background:#e2e8f0; overflow:hidden; margin-top:8px; }
    .progress-fill { height:100%; background:${riskColor}; border-radius:4px; width:${summary.riskScore}%; }
  </style>
</head>
<body>
<div class="header">
  <h1>🔍 Vulentry — Security Scan Report</h1>
  <p>Target: <strong>${escHtml(meta.targetPath)}</strong> &nbsp;|&nbsp; Generated: ${new Date(meta.generatedAt).toLocaleString()} &nbsp;|&nbsp; ${meta.scanner}</p>
</div>
<div class="container">

  <!-- Summary Cards -->
  <div class="cards">
    <div class="card">
      <div class="label">Risk Level</div>
      <div class="value" style="color:${riskColor}">${summary.riskLevel}</div>
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px">Score: ${summary.riskScore}/100</div>
    </div>
    <div class="card"><div class="label">Total Findings</div><div class="value" style="color:#0f172a">${summary.totalFindings}</div></div>
    <div class="card"><div class="label">Critical</div><div class="value" style="color:#dc2626">${summary.bySeverity.CRITICAL}</div></div>
    <div class="card"><div class="label">High</div><div class="value" style="color:#ea580c">${summary.bySeverity.HIGH}</div></div>
    <div class="card"><div class="label">Medium</div><div class="value" style="color:#d97706">${summary.bySeverity.MEDIUM}</div></div>
    <div class="card"><div class="label">Low</div><div class="value" style="color:#2563eb">${summary.bySeverity.LOW || 0}</div></div>
  </div>

  <!-- Findings Table -->
  <div class="section">
    <div class="section-header"><h2>📋 All Findings (${summary.totalFindings})</h2></div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Severity</th><th>Category</th><th>Description</th><th>File</th>
          <th>Line</th><th>Code Snippet</th><th>CWE</th><th>OWASP</th><th>Source</th>
        </tr></thead>
        <tbody>${findingRows || '<tr><td colspan="9" style="padding:20px;text-align:center;color:#6b7280">No findings</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <!-- Categories -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
    <div class="section">
      <div class="section-header"><h2>📊 By Category</h2></div>
      <table>
        <thead><tr><th>Category</th><th style="text-align:center">Count</th></tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-header"><h2>📁 Most Vulnerable Files</h2></div>
      <table>
        <thead><tr><th>File</th><th style="text-align:center">Issues</th></tr></thead>
        <tbody>
          ${(summary.topVulnerableFiles || []).map((f) =>
            `<tr><td style="padding:8px 12px;font-size:12px;word-break:break-all">${escHtml(f.file.split(/[\\/]/).slice(-3).join('/'))}</td><td style="padding:8px 12px;text-align:center;font-weight:700">${f.count}</td></tr>`
          ).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Agent Logs -->
  <div class="section">
    <div class="section-header"><h2>🤖 Agent Reasoning Logs</h2></div>
    <div style="padding:16px">
      <div class="log-box">${logHtml || '<div style="color:#64748b;font-size:13px">No logs recorded</div>'}</div>
    </div>
  </div>

</div>
</body>
</html>`;

    return html;
  },
});

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { buildReportTool, renderHtmlReportTool };
