<<<<<<< HEAD
/**
 * REPORT GENERATOR TOOLS
 * Compiles all findings from all agents into a structured
 * JSON report and renders it as an HTML document for the VS Code webview.
=======
﻿'use strict';

/**
 * ZEROTRACE REPORT GENERATOR v3
 * Multi-Agent Security Scanner — Professional Report Engine
 *
 * Produces a structured JSON report and renders a production-grade
 * interactive HTML security audit report optimised for VS Code webview.
 *
 * Sections:
 *   1. Executive Dashboard  — risk score, severity matrix, scan metadata
 *   2. Severity Distribution — visual breakdown with proportional bars
 *   3. OWASP Top-10 Mapping — categorised finding counts
 *   4. Attack Chain Analysis — linear kill-chain model (when critical findings present)
 *   5. Most Vulnerable Files — ranked file table with per-file severity
 *   6. Vulnerability Categories — grouped category table
 *   7. Agent Coverage        — per-agent finding counts
 *   8. All Findings          — filterable, sortable, expandable findings table
 *   9. Pipeline Logs         — agent execution log timeline
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
 */

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

<<<<<<< HEAD
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
=======
/* ─── Constants ─────────────────────────────────────────────────── */

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

const SEV_HEX = {
  CRITICAL: '#e53935',
  HIGH:     '#fb8c00',
  MEDIUM:   '#fdd835',
  LOW:      '#42a5f5',
  INFO:     '#9e9e9e',
};

const OWASP_LABEL = {
  A01: 'Broken Access Control',
  A02: 'Cryptographic Failures',
  A03: 'Injection',
  A04: 'Insecure Design',
  A05: 'Security Misconfiguration',
  A06: 'Vulnerable Components',
  A07: 'Auth Failures',
  A08: 'Integrity Failures',
  A09: 'Logging Failures',
  A10: 'SSRF',
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sevHex(sev) { return SEV_HEX[sev] || '#9e9e9e'; }

function owaspLabel(code) {
  const k = (code || '').slice(0, 3);
  return OWASP_LABEL[k] || code || 'Unknown';
}

/* ─── Tool 1 — Build Structured JSON Report ─────────────────────── */

const buildReportTool = new DynamicStructuredTool({
  name: 'build_report',
  description: 'Consolidate all vulnerability findings into a single structured JSON report.',
  schema: z.object({
    targetPath:      z.string(),
    patternFindings: z.array(z.any()).optional().default([]),
    secretFindings:  z.array(z.any()).optional().default([]),
    astFindings:     z.array(z.any()).optional().default([]),
    depFindings:     z.array(z.any()).optional().default([]),
    llmFindings:     z.array(z.any()).optional().default([]),
    authFindings:    z.array(z.any()).optional().default([]),
    bizFindings:     z.array(z.any()).optional().default([]),
    apiFindings:     z.array(z.any()).optional().default([]),
    frontendFindings:z.array(z.any()).optional().default([]),
    infraFindings:   z.array(z.any()).optional().default([]),
    cryptoFindings:  z.array(z.any()).optional().default([]),
    loggingFindings: z.array(z.any()).optional().default([]),
    agentLogs:       z.array(z.string()).optional().default([]),
    scanDurationMs:  z.number().optional().default(0),
  }),

  func: async (input) => {
    const {
      targetPath, patternFindings, secretFindings, astFindings, depFindings,
      llmFindings, authFindings, bizFindings, apiFindings, frontendFindings,
      infraFindings, cryptoFindings, loggingFindings, agentLogs, scanDurationMs,
    } = input;

    const tagged = (arr, src) => arr.map(f => ({ ...f, source: f.source || src }));

    const allFindings = [
      ...tagged(patternFindings,  'Pattern Scan'),
      ...tagged(secretFindings,   'Secret Scan'),
      ...tagged(astFindings,      'AST Scan'),
      ...tagged(depFindings,      'Dependency Audit'),
      ...tagged(llmFindings,      'LLM Analysis'),
      ...tagged(authFindings,     'Auth Analysis'),
      ...tagged(bizFindings,      'Business Logic'),
      ...tagged(apiFindings,      'API Security'),
      ...tagged(frontendFindings, 'Frontend Security'),
      ...tagged(infraFindings,    'Infrastructure'),
      ...tagged(cryptoFindings,   'Cryptography'),
      ...tagged(loggingFindings,  'Logging & Monitoring'),
    ];

    // Deduplication
    const seen = new Set();
    const unique = allFindings.filter(f => {
      const key = `${f.file || ''}:${f.line || 0}:${(f.ruleId || f.category || f.description || '').slice(0, 40)}`;
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
<<<<<<< HEAD

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
=======
    unique.sort((a, b) => (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5));

    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    const byCategory = {}, bySource = {}, byFile = {}, byOwasp = {};

    for (const f of unique) {
      const sev  = f.severity || 'INFO';
      const cat  = f.category || 'Uncategorized';
      const src  = f.source   || 'Unknown';
      const file = f.file     || 'unknown';
      const owasp = (f.owasp  || 'Unknown').slice(0, 7);

      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      bySource[src]   = (bySource[src]   || 0) + 1;
      if (!byFile[file]) byFile[file] = [];
      byFile[file].push(f);
      byOwasp[owasp]  = (byOwasp[owasp]  || 0) + 1;
    }

    const riskScore = Math.min(100,
      bySeverity.CRITICAL * 25 + bySeverity.HIGH * 10 +
      bySeverity.MEDIUM   * 3  + bySeverity.LOW  * 1
    );
    const riskLevel = riskScore >= 75 ? 'CRITICAL'
                    : riskScore >= 50 ? 'HIGH'
                    : riskScore >= 25 ? 'MEDIUM' : 'LOW';

    const topVulnerableFiles = Object.entries(byFile)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 10)
      .map(([file, fArr]) => ({
        file,
        count: fArr.length,
        topSeverity: fArr[0]?.severity || 'INFO',
        severityBreakdown: fArr.reduce((acc, f) => {
          acc[f.severity || 'INFO'] = (acc[f.severity || 'INFO'] || 0) + 1;
          return acc;
        }, {}),
      }));

    return JSON.stringify({
      meta: {
        targetPath,
        generatedAt:   new Date().toISOString(),
        scanDurationMs,
        scanner:       'ZeroTrace — Multi-Agent Security Scanner v3',
        model:         'Mistral AI (LangGraph Orchestration)',
        agentCount:    12,
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      },
      summary: {
        totalFindings: unique.length,
        riskScore,
        riskLevel,
        bySeverity,
        byCategory,
<<<<<<< HEAD
        topVulnerableFiles: Object.entries(byFile)
          .sort(([, a], [, b]) => b.length - a.length)
          .slice(0, 10)
          .map(([file, findings]) => ({ file, count: findings.length })),
=======
        bySource,
        byOwasp,
        topVulnerableFiles,
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      },
      findings: unique,
      byFile,
      agentLogs,
<<<<<<< HEAD
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
=======
    });
  },
});

/* ─── Tool 2 — Render Professional HTML Report ───────────────────── */

const renderHtmlReportTool = new DynamicStructuredTool({
  name: 'render_html_report',
  description: 'Render a professional, interactive HTML security audit report.',
  schema: z.object({ report: z.any() }),

  func: async ({ report }) => {
    const r = typeof report === 'string' ? JSON.parse(report) : report;
    const { meta, summary, findings, agentLogs } = r;
    const now = new Date(meta.generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    const dur = (meta.scanDurationMs / 1000).toFixed(2);
    const hasCritical = (summary.bySeverity.CRITICAL || 0) > 0;

    /* ── Severity bar rows ── */
    const maxSev = Math.max(...Object.values(summary.bySeverity));
    const sevRows = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s => {
      const n   = summary.bySeverity[s] || 0;
      const pct = maxSev ? Math.round((n / maxSev) * 100) : 0;
      return `
        <tr class="sev-row" data-sev="${s}">
          <td><span class="badge badge--${s.toLowerCase()}">${s}</span></td>
          <td class="bar-cell">
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${sevHex(s)}"></div></div>
          </td>
          <td class="num">${n}</td>
          <td class="pct">${summary.totalFindings ? ((n / summary.totalFindings) * 100).toFixed(1) : '0.0'}%</td>
        </tr>`;
    }).join('');

    /* ── OWASP table rows ── */
    const owaspRows = Object.entries(summary.byOwasp || {})
      .sort(([, a], [, b]) => b - a)
      .map(([code, n]) => {
        const pct = summary.totalFindings ? ((n / summary.totalFindings) * 100).toFixed(1) : '0.0';
        return `
        <tr>
          <td class="mono">${esc(code)}</td>
          <td>${esc(owaspLabel(code))}</td>
          <td class="num">${n}</td>
          <td class="pct">${pct}%</td>
        </tr>`;
      }).join('');

    /* ── Vulnerable files table rows ── */
    const fileRows = (summary.topVulnerableFiles || []).map((f, i) => {
      const display = f.file.replace(/\\/g, '/').split('/').slice(-4).join('/');
      const sevCells = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s =>
        `<td class="num" style="color:${(f.severityBreakdown?.[s] || 0) > 0 ? sevHex(s) : '#3a3f4b'}">${f.severityBreakdown?.[s] || 0}</td>`
      ).join('');
      return `
        <tr>
          <td class="num dim">${i + 1}</td>
          <td class="mono file-path">${esc(display)}</td>
          ${sevCells}
          <td class="num"><strong>${f.count}</strong></td>
        </tr>`;
    }).join('');

    /* ── Category table rows ── */
    const catRows = Object.entries(summary.byCategory || {})
      .sort(([, a], [, b]) => b - a)
      .map(([cat, n]) => {
        const topSev = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].find(s =>
          findings.some(f => (f.category || f.name) === cat && f.severity === s)) || 'INFO';
        return `
        <tr>
          <td>${esc(cat)}</td>
          <td><span class="badge badge--${topSev.toLowerCase()}">${topSev}</span></td>
          <td class="num">${n}</td>
        </tr>`;
      }).join('');

    /* ── Agent coverage table rows ── */
    const agentRows = Object.entries(summary.bySource || {})
      .sort(([, a], [, b]) => b - a)
      .map(([src, n]) => `
        <tr>
          <td>${esc(src)}</td>
          <td class="num">${n}</td>
        </tr>`
      ).join('');

    /* ── Finding rows ── */
    const findingRows = findings.map((f, i) => {
      const sev     = f.severity || 'INFO';
      const cat     = esc(f.category || f.name || 'Unknown');
      const desc    = esc(f.description || '');
      const file    = esc((f.file || '').replace(/\\/g, '/').split('/').slice(-4).join('/'));
      const snippet = (f.snippet || f.match || '').slice(0, 400);
      const poc     = typeof f.poc === 'object' ? JSON.stringify(f.poc, null, 2) : String(f.poc || '');
      const fix     = String(f.fix || '');

      return `
        <tr class="finding-row" data-sev="${sev}" data-idx="${i}" tabindex="0">
          <td><span class="badge badge--${sev.toLowerCase()}">${sev}</span></td>
          <td class="rule-id mono dim">${esc(f.ruleId || '—')}</td>
          <td>${cat}</td>
          <td class="desc-cell">${desc}</td>
          <td class="mono file-path">${file}${f.line ? `<span class="line-no">:${f.line}</span>` : ''}</td>
          <td class="mono dim">${esc(f.cwe || '—')}</td>
          <td class="mono dim">${esc((f.owasp || '—').split(':')[0])}</td>
          <td class="dim">${esc(f.source || '—')}</td>
        </tr>
        <tr class="detail-row hidden" data-detail="${i}">
          <td colspan="8">
            <div class="detail-panel">
              ${snippet ? `
              <div class="detail-section">
                <h4 class="detail-heading">Vulnerable Code</h4>
                <pre class="code-block"><code>${esc(snippet)}</code></pre>
              </div>` : ''}
              ${poc ? `
              <div class="detail-section">
                <h4 class="detail-heading">Proof of Concept</h4>
                <pre class="code-block code-block--poc"><code>${esc(poc)}</code></pre>
              </div>` : ''}
              ${fix ? `
              <div class="detail-section">
                <h4 class="detail-heading">Recommended Remediation</h4>
                <pre class="code-block code-block--fix"><code>${esc(fix)}</code></pre>
              </div>` : ''}
              <div class="detail-meta">
                ${f.cwe   ? `<span class="tag">${esc(f.cwe)}</span>` : ''}
                ${f.owasp ? `<span class="tag">${esc(f.owasp)}</span>` : ''}
                ${f.cvss  ? `<span class="tag">CVSS ${esc(String(f.cvss))}</span>` : ''}
                <span class="tag">${esc(f.source || '')}</span>
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');

    /* ── Log lines ── */
    const logLines = (agentLogs || []).map((l, i) => {
      const cls = /error|fail/i.test(l)    ? 'log--error'
                : /warn|skip/i.test(l)     ? 'log--warn'
                : /complete|done|found/i.test(l) ? 'log--ok'
                : 'log--info';
      return `<div class="log-line ${cls}"><span class="log-idx">${String(i + 1).padStart(3, '0')}</span>${esc(l)}</div>`;
    }).join('');

    /* ── Attack chain (critical only) ── */
    const attackChain = hasCritical ? `
      <section class="section" id="attack-chain">
        <h2 class="section-title">Attack Chain Analysis</h2>
        <p class="section-sub">Illustrative kill-chain derived from detected critical and high-severity findings.</p>
        <div class="chain-table-wrap">
          <table class="chain-table">
            <thead>
              <tr>
                <th>Stage</th><th>Technique</th><th>Evidence</th><th>Impact</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="chain-stage">Reconnaissance</td>
                <td>Endpoint enumeration, error disclosure, GraphQL introspection</td>
                <td class="mono dim">Exposed routes, verbose stack traces</td>
                <td>Attack surface mapping</td>
              </tr>
              <tr>
                <td class="chain-stage">Initial Access</td>
                <td>Credential abuse, JWT forgery, hardcoded secrets</td>
                <td class="mono dim">Weak signing keys, plaintext credentials</td>
                <td>Authenticated session</td>
              </tr>
              <tr>
                <td class="chain-stage">Privilege Escalation</td>
                <td>IDOR, mass assignment, RBAC bypass</td>
                <td class="mono dim">Missing ownership checks, unvalidated roles</td>
                <td>Administrative access</td>
              </tr>
              <tr>
                <td class="chain-stage">Exploitation</td>
                <td>SQL injection, command injection, stored XSS</td>
                <td class="mono dim">Unsanitised inputs, raw query construction</td>
                <td>Remote code execution / data exfil</td>
              </tr>
              <tr>
                <td class="chain-stage">Exfiltration</td>
                <td>Excessive data exposure, unbounded queries</td>
                <td class="mono dim">Over-permissive API responses</td>
                <td>PII / credential dump</td>
              </tr>
              <tr>
                <td class="chain-stage">Persistence</td>
                <td>Infrastructure misconfiguration, absent audit logging</td>
                <td class="mono dim">No rotation policy, disabled monitoring</td>
                <td>Long-term foothold</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>` : '';

    /* ═══════════════════════════════════════════════════════════════════
       FULL HTML DOCUMENT
    ═══════════════════════════════════════════════════════════════════ */
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZeroTrace Security Report — ${esc(meta.targetPath)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
/* ── Reset & Base ─────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:         #0d0f12;
  --surface:    #13161c;
  --surface-2:  #1a1e27;
  --surface-3:  #20252f;
  --border:     #262c38;
  --border-2:   #2e3545;
  --text:        #dce3ef;
  --text-dim:    #6b7690;
  --text-mid:    #9aa3ba;
  --accent:      #3b82f6;
  --accent-dim:  rgba(59,130,246,.12);
  --c-critical:  #e53935;
  --c-high:      #fb8c00;
  --c-medium:    #fdd835;
  --c-low:       #42a5f5;
  --c-info:      #78909c;
  --font-sans:   'IBM Plex Sans', sans-serif;
  --font-mono:   'IBM Plex Mono', monospace;
  --radius:      4px;
  --radius-lg:   6px;
  --header-h:    64px;
}
html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
a { color: var(--accent); text-decoration: none; }
strong { font-weight: 600; }
pre, code { font-family: var(--font-mono); }

/* ── Scrollbar ──────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }

/* ── Layout shell ───────────────────────────────────────────── */
.layout { display: flex; min-height: 100vh; }

/* ── Sidebar nav ────────────────────────────────────────────── */
.sidebar {
  position: fixed; top: 0; left: 0;
  width: 220px; height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  z-index: 100;
  overflow-y: auto;
}
.sidebar-logo {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}
.logo-mark {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text);
}
.logo-sub {
  font-size: 10px;
  color: var(--text-dim);
  letter-spacing: .06em;
  margin-top: 2px;
}
.nav-section { padding: 16px 0 8px; }
.nav-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 0 20px;
  margin-bottom: 4px;
}
.nav-item {
  display: block;
  padding: 7px 20px;
  font-size: 12px;
  color: var(--text-mid);
  cursor: pointer;
  transition: background .15s, color .15s;
  border-left: 2px solid transparent;
  text-decoration: none;
}
.nav-item:hover, .nav-item.active {
  background: var(--surface-2);
  color: var(--text);
  border-left-color: var(--accent);
}

.sidebar-risk {
  margin: auto 20px 20px;
  padding: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.sidebar-risk-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.sidebar-risk-score {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 500;
  color: ${sevHex(summary.riskLevel)};
  line-height: 1;
}
.sidebar-risk-level {
  font-size: 11px;
  font-weight: 600;
  color: ${sevHex(summary.riskLevel)};
  letter-spacing: .08em;
  margin-top: 4px;
}

/* ── Main content ───────────────────────────────────────────── */
.main {
  margin-left: 220px;
  flex: 1;
  min-width: 0;
}

/* ── Page header ────────────────────────────────────────────── */
.page-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 28px 40px 24px;
}
.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.header-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -.01em;
  color: var(--text);
}
.header-path {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  margin-top: 4px;
  word-break: break-all;
}
.header-meta {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-dim); font-weight: 500; }
.meta-value { font-size: 12px; color: var(--text); font-family: var(--font-mono); }

/* ── Content area ────────────────────────────────────────────── */
.content { padding: 36px 40px; }

/* ── Sections ────────────────────────────────────────────────── */
.section { margin-bottom: 48px; scroll-margin-top: 24px; }
.section-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-mid);
  margin-bottom: 6px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.section-sub {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 16px;
  margin-top: 6px;
}

/* ── Dashboard grid ─────────────────────────────────────────── */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 24px;
}
.kpi-card {
  background: var(--surface);
  padding: 20px 20px 16px;
}
.kpi-label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 10px;
}
.kpi-value {
  font-family: var(--font-mono);
  font-size: 28px;
  font-weight: 500;
  line-height: 1;
  color: var(--text);
}
.kpi-value.critical { color: var(--c-critical); }
.kpi-value.high     { color: var(--c-high); }
.kpi-value.medium   { color: var(--c-medium); }
.kpi-value.low      { color: var(--c-low); }
.kpi-sub { font-size: 10px; color: var(--text-dim); margin-top: 5px; }

/* ── Two-col layout ─────────────────────────────────────────── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }

/* ── Card ─────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.card-head {
  padding: 13px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-mid);
}
.card-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

/* ── Tables ──────────────────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
table th {
  padding: 9px 12px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-dim);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: top;
}
table tbody tr:last-child td { border-bottom: none; }
table tbody tr:hover td { background: var(--surface-2); }
.num  { text-align: right; font-family: var(--font-mono); white-space: nowrap; }
.pct  { text-align: right; font-family: var(--font-mono); color: var(--text-dim); white-space: nowrap; }
.mono { font-family: var(--font-mono); font-size: 11px; }
.dim  { color: var(--text-dim); }
.file-path { word-break: break-all; font-size: 11px; max-width: 320px; }
.line-no { color: var(--text-dim); }
.desc-cell { max-width: 300px; }

/* ── Severity bar ─────────────────────────────────────────────── */
.bar-cell { width: 40%; }
.bar-track {
  height: 5px;
  background: var(--surface-3);
  border-radius: 2px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width .3s ease;
}

/* ── Badge ───────────────────────────────────────────────────── */
.badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: .08em;
  padding: 2px 7px;
  border-radius: 2px;
  white-space: nowrap;
  text-transform: uppercase;
}
.badge--critical { background: rgba(229,57,53,.15);  color: var(--c-critical); border: 1px solid rgba(229,57,53,.25);  }
.badge--high     { background: rgba(251,140,0,.12);  color: var(--c-high);     border: 1px solid rgba(251,140,0,.22);  }
.badge--medium   { background: rgba(253,216,53,.10); color: var(--c-medium);   border: 1px solid rgba(253,216,53,.20); }
.badge--low      { background: rgba(66,165,245,.12); color: var(--c-low);      border: 1px solid rgba(66,165,245,.22); }
.badge--info     { background: rgba(120,144,156,.10);color: var(--c-info);     border: 1px solid rgba(120,144,156,.2); }

/* ── Tag ──────────────────────────────────────────────────────── */
.tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 8px;
  background: var(--surface-3);
  border: 1px solid var(--border-2);
  border-radius: 2px;
  color: var(--text-mid);
  margin-right: 6px;
  margin-top: 4px;
}

/* ── Findings table specific ─────────────────────────────────── */
.findings-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.filter-btn {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 2px;
  border: 1px solid var(--border-2);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition: all .15s;
}
.filter-btn:hover { border-color: var(--text-dim); color: var(--text); }
.filter-btn.active { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); }
.findings-count {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  margin-left: auto;
}
.search-input {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px 10px;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
  width: 200px;
  transition: border-color .15s;
}
.search-input::placeholder { color: var(--text-dim); }
.search-input:focus { border-color: var(--accent); }

.finding-row { cursor: pointer; }
.finding-row td { transition: background .1s; }
.finding-row:hover td, .finding-row.open td { background: var(--surface-2); }
.finding-row.open td { border-bottom: none; }
.detail-row { display: none; }
.detail-row.visible { display: table-row; }
.detail-panel {
  padding: 18px 20px 20px;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.detail-section { margin-bottom: 16px; }
.detail-heading {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 8px;
}
.code-block {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  font-size: 11px;
  line-height: 1.7;
  overflow-x: auto;
  color: var(--text);
  max-height: 300px;
  overflow-y: auto;
}
.code-block--poc  { border-color: rgba(229,57,53,.25);  }
.code-block--fix  { border-color: rgba(66,165,245,.25); }
.detail-meta { margin-top: 12px; }

/* ── Attack chain table ──────────────────────────────────────── */
.chain-table-wrap { overflow-x: auto; }
.chain-table { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
.chain-table th { background: var(--surface-2); }
.chain-stage {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--c-high);
  white-space: nowrap;
}

/* ── Pipeline logs ───────────────────────────────────────────── */
.log-wrap {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
  max-height: 420px;
  overflow-y: auto;
}
.log-line {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding: 3px 0;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.6;
  border-bottom: 1px solid var(--border);
}
.log-line:last-child { border-bottom: none; }
.log-idx  { color: var(--text-dim); min-width: 28px; }
.log--info  { color: var(--text-mid); }
.log--ok    { color: #4caf50; }
.log--warn  { color: var(--c-medium); }
.log--error { color: var(--c-critical); }

/* ── Risk indicator (header) ─────────────────────────────────── */
.risk-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border: 1px solid ${sevHex(summary.riskLevel)}44;
  border-radius: 2px;
  background: ${sevHex(summary.riskLevel)}12;
}
.risk-pill-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--text-dim);
}
.risk-pill-value {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: ${sevHex(summary.riskLevel)};
  letter-spacing: .04em;
}

/* ── Footer ──────────────────────────────────────────────────── */
.footer {
  padding: 20px 40px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width: 1100px) {
  .dashboard-grid { grid-template-columns: repeat(3, 1fr); }
  .two-col, .three-col { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .sidebar { display: none; }
  .main { margin-left: 0; }
  .content { padding: 24px 16px; }
  .page-header { padding: 20px 16px; }
  .dashboard-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Print ───────────────────────────────────────────────────── */
@media print {
  .sidebar, .findings-filter-bar { display: none; }
  .main { margin-left: 0; }
  .detail-row { display: table-row !important; }
  .detail-row td { display: table-cell !important; }
}
</style>
</head>
<body>
<div class="layout">

<!-- ── Sidebar ─────────────────────────────────────────────── -->
<nav class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-mark">ZeroTrace</div>
    <div class="logo-sub">Security Audit Report</div>
  </div>

  <div class="nav-section">
    <div class="nav-label">Report</div>
    <a class="nav-item active" href="#dashboard">Dashboard</a>
    <a class="nav-item" href="#severity">Severity Distribution</a>
    <a class="nav-item" href="#owasp">OWASP Mapping</a>
    ${hasCritical ? `<a class="nav-item" href="#attack-chain">Attack Chain</a>` : ''}
  </div>

  <div class="nav-section">
    <div class="nav-label">Analysis</div>
    <a class="nav-item" href="#files">Vulnerable Files</a>
    <a class="nav-item" href="#categories">Categories</a>
    <a class="nav-item" href="#agents">Agent Coverage</a>
  </div>

  <div class="nav-section">
    <div class="nav-label">Findings</div>
    <a class="nav-item" href="#findings">All Findings</a>
    <a class="nav-item" href="#logs">Pipeline Logs</a>
  </div>

  <div class="sidebar-risk">
    <div class="sidebar-risk-label">Overall Risk</div>
    <div class="sidebar-risk-score">${summary.riskScore}</div>
    <div class="sidebar-risk-level">${summary.riskLevel}</div>
  </div>
</nav>

<!-- ── Main ──────────────────────────────────────────────────── -->
<div class="main">

  <!-- Page Header -->
  <header class="page-header">
    <div class="header-top">
      <div>
        <div class="header-title">Security Audit Report</div>
        <div class="header-path">${esc(meta.targetPath)}</div>
      </div>
      <div class="risk-pill">
        <span class="risk-pill-label">Risk Score</span>
        <span class="risk-pill-value">${summary.riskScore}/100 &mdash; ${summary.riskLevel}</span>
      </div>
    </div>
    <div class="header-meta">
      <div class="meta-item">
        <span class="meta-label">Generated</span>
        <span class="meta-value">${now}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Duration</span>
        <span class="meta-value">${dur}s</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Scanner</span>
        <span class="meta-value">${esc(meta.scanner)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Model</span>
        <span class="meta-value">${esc(meta.model)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Agents</span>
        <span class="meta-value">${meta.agentCount}</span>
      </div>
    </div>
  </header>

  <!-- Content -->
  <div class="content">

    <!-- ── Dashboard ───────────────────────────────────────── -->
    <section class="section" id="dashboard">
      <h2 class="section-title">Executive Dashboard</h2>
      <div class="dashboard-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Findings</div>
          <div class="kpi-value">${summary.totalFindings}</div>
          <div class="kpi-sub">across all agents</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Critical</div>
          <div class="kpi-value critical">${summary.bySeverity.CRITICAL || 0}</div>
          <div class="kpi-sub">requires immediate action</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">High</div>
          <div class="kpi-value high">${summary.bySeverity.HIGH || 0}</div>
          <div class="kpi-sub">fix within 7 days</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Medium</div>
          <div class="kpi-value medium">${summary.bySeverity.MEDIUM || 0}</div>
          <div class="kpi-sub">plan remediation</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Low / Info</div>
          <div class="kpi-value low">${(summary.bySeverity.LOW || 0) + (summary.bySeverity.INFO || 0)}</div>
          <div class="kpi-sub">track &amp; monitor</div>
        </div>
      </div>
    </section>

    <!-- ── Severity Distribution ────────────────────────────── -->
    <section class="section" id="severity">
      <h2 class="section-title">Severity Distribution</h2>
      <div class="card">
        <div class="card-head">
          <span class="card-title">Finding Breakdown by Severity</span>
          <span class="card-count">${summary.totalFindings} total</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:110px">Severity</th>
                <th>Distribution</th>
                <th style="width:60px">Count</th>
                <th style="width:60px">Share</th>
              </tr>
            </thead>
            <tbody>${sevRows}</tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── OWASP ─────────────────────────────────────────────── -->
    <section class="section" id="owasp">
      <h2 class="section-title">OWASP Top 10 Mapping</h2>
      <div class="card">
        <div class="card-head">
          <span class="card-title">Finding Distribution by OWASP Category</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:80px">Code</th>
                <th>Category</th>
                <th style="width:60px">Count</th>
                <th style="width:60px">Share</th>
              </tr>
            </thead>
            <tbody>
              ${owaspRows || '<tr><td colspan="4" class="dim" style="text-align:center;padding:20px">No OWASP mapping data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── Attack Chain ──────────────────────────────────────── -->
    ${attackChain}

    <!-- ── Vulnerable Files ──────────────────────────────────── -->
    <section class="section" id="files">
      <h2 class="section-title">Most Vulnerable Files</h2>
      <p class="section-sub">Top ${Math.min(10, (summary.topVulnerableFiles || []).length)} files ranked by finding count.</p>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:32px">#</th>
                <th>File Path</th>
                <th style="width:72px;color:var(--c-critical)">CRIT</th>
                <th style="width:72px;color:var(--c-high)">HIGH</th>
                <th style="width:72px;color:var(--c-medium)">MED</th>
                <th style="width:72px;color:var(--c-low)">LOW</th>
                <th style="width:72px;color:var(--c-info)">INFO</th>
                <th style="width:72px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${fileRows || '<tr><td colspan="8" class="dim" style="text-align:center;padding:20px">No file data available</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── Categories + Agents ──────────────────────────────── -->
    <section class="section" id="categories">
      <h2 class="section-title">Vulnerability Categories &amp; Agent Coverage</h2>
      <div class="two-col">
        <div class="card" id="categories-card">
          <div class="card-head">
            <span class="card-title">By Category</span>
            <span class="card-count">${Object.keys(summary.byCategory || {}).length} categories</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Category</th><th>Top Severity</th><th>Count</th></tr>
              </thead>
              <tbody>
                ${catRows || '<tr><td colspan="3" class="dim" style="text-align:center;padding:20px">No data</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" id="agents">
          <div class="card-head">
            <span class="card-title">By Agent</span>
            <span class="card-count">${Object.keys(summary.bySource || {}).length} agents</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Agent</th><th>Findings</th></tr>
              </thead>
              <tbody>
                ${agentRows || '<tr><td colspan="2" class="dim" style="text-align:center;padding:20px">No data</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- ── All Findings ──────────────────────────────────────── -->
    <section class="section" id="findings">
      <h2 class="section-title">All Findings</h2>
      <p class="section-sub">Click any row to expand the code snippet, proof of concept, and remediation guidance.</p>
      <div class="card">
        <div class="findings-filter-bar">
          <button class="filter-btn active" data-filter="all">All</button>
          ${['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s =>
            `<button class="filter-btn" data-filter="${s}">${s} <span style="color:${sevHex(s)}">${summary.bySeverity[s] || 0}</span></button>`
          ).join('')}
          <input class="search-input" type="text" id="search-input" placeholder="Search findings...">
          <span class="findings-count" id="findings-count">${findings.length} findings</span>
        </div>
        <div class="table-wrap">
          <table id="findings-table">
            <thead>
              <tr>
                <th style="width:90px">Severity</th>
                <th style="width:100px">Rule ID</th>
                <th style="width:140px">Category</th>
                <th>Description</th>
                <th style="width:220px">File</th>
                <th style="width:80px">CWE</th>
                <th style="width:60px">OWASP</th>
                <th style="width:130px">Agent</th>
              </tr>
            </thead>
            <tbody id="findings-body">
              ${findingRows || '<tr><td colspan="8" class="dim" style="text-align:center;padding:32px">No vulnerabilities detected</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ── Pipeline Logs ─────────────────────────────────────── -->
    <section class="section" id="logs">
      <h2 class="section-title">Pipeline Logs</h2>
      <p class="section-sub">Agent execution log from the most recent scan run.</p>
      <div class="log-wrap">
        ${logLines || '<div class="dim" style="padding:8px;font-size:11px;font-family:var(--font-mono)">No log output available.</div>'}
      </div>
    </section>

  </div><!-- /content -->

  <!-- Footer -->
  <footer class="footer">
    <span>${esc(meta.scanner)}</span>
    <span>${now}</span>
  </footer>

</div><!-- /main -->
</div><!-- /layout -->

<script>
(function () {
  /* ── Finding row expand/collapse ── */
  const body = document.getElementById('findings-body');
  if (body) {
    body.addEventListener('click', function (e) {
      const row = e.target.closest('.finding-row');
      if (!row) return;
      const idx = row.dataset.idx;
      const detail = document.querySelector('[data-detail="' + idx + '"]');
      if (!detail) return;
      const isOpen = row.classList.contains('open');
      row.classList.toggle('open', !isOpen);
      detail.classList.toggle('visible', !isOpen);
    });
    body.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.finding-row');
      if (row) row.click();
    });
  }

  /* ── Severity filter ── */
  let activeFilter = 'all';
  let searchTerm   = '';

  function applyFilters() {
    const rows   = document.querySelectorAll('.finding-row');
    let visible  = 0;
    rows.forEach(function (row) {
      const detail = document.querySelector('[data-detail="' + row.dataset.idx + '"]');
      const sev    = row.dataset.sev;
      const text   = row.textContent.toLowerCase();
      const sevOk  = activeFilter === 'all' || sev === activeFilter;
      const srchOk = !searchTerm || text.includes(searchTerm);
      const show   = sevOk && srchOk;
      row.style.display = show ? '' : 'none';
      if (detail && !show) {
        detail.classList.remove('visible');
        row.classList.remove('open');
      }
      if (show) visible++;
    });
    const ctr = document.getElementById('findings-count');
    if (ctr) ctr.textContent = visible + ' finding' + (visible === 1 ? '' : 's');
  }

  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      applyFilters();
    });
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      searchTerm = this.value.toLowerCase().trim();
      applyFilters();
    });
  }

  /* ── Active nav link on scroll ── */
  const sections = document.querySelectorAll('.section');
  const navLinks  = document.querySelectorAll('.nav-item');
  function onScroll() {
    let current = '';
    sections.forEach(function (s) {
      if (window.scrollY >= s.offsetTop - 80) current = s.id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
})();
</script>
</body>
</html>`;
  },
});

module.exports = { buildReportTool, renderHtmlReportTool };
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
