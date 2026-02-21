const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { marked } = require('marked');

function createScanFolder() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const scanFolder = path.join(__dirname, '..', 'scans', `scan-${timestamp}`);
    fs.mkdirSync(scanFolder, { recursive: true });
    return scanFolder;
}

async function generateReport(scanFolder, target, report) {
    // Save JSON report
    const jsonPath = path.join(scanFolder, 'report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Generate Markdown report
    const mdPath = path.join(scanFolder, 'report.md');
    const md = generateMarkdown(report);
    fs.writeFileSync(mdPath, md);

    const pdfPath = path.join(scanFolder, 'report.pdf');
    try {
        const htmlBody = marked(md);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; padding: 30px 40px; color: #222; }
  h1 { color: #1a1a2e; border-bottom: 2px solid #e63946; padding-bottom: 6px; }
  h2 { color: #16213e; margin-top: 24px; }
  h3 { color: #0f3460; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 12px; }
  th { background: #f0f0f0; }
  code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
  blockquote { border-left: 4px solid #e63946; margin: 0; padding: 4px 12px; background: #fff5f5; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
</style></head><body>${htmlBody}</body></html>`;

        const browser = await puppeteer.launch({
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
        await browser.close();
        console.log(`[ReportGenerator] PDF saved to ${pdfPath}`);
    } catch (err) {
        console.error(`[ReportGenerator] PDF generation failed: ${err.message}`);
    }

    return { jsonPath, mdPath, pdfPath };
}

function generateMarkdown(report) {
    const lines = [];
    const s = report.scanSummary;

    // Report Header & Stats (Compact)
    lines.push(`# 🛡️ Security Audit: ${s.target}`);
    lines.push(`> **ID**: ${s.scanId} | **Date**: ${s.startTime.split('T')[0]} | **Findings**: ${s.totalFindings}\n`);

    const stats = report.statistics.bySeverity;
    lines.push(`| Sev | 🔴 Crit | 🟠 High | 🟡 Med | 🔵 Low | ⚪ Info |`);
    lines.push(`|---|---|---|---|---|---|`);
    lines.push(`| **Amt** | ${stats.critical} | ${stats.high} | ${stats.medium} | ${stats.low} | ${stats.info} |\n`);

    // Quick Overview
    if (report.findings.length > 0) {
        lines.push('### 📋 Findings Summary');
        lines.push(`| # | Sev | Type | Endpoint |`);
        lines.push(`|---|---|---|---|`);

        const severityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'Info': 4 };
        const sorted = [...report.findings].sort((a, b) => (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5));

        for (let i = 0; i < sorted.length; i++) {
            const f = sorted[i];
            const icon = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🔵', Info: '⚪' }[f.severity] || '❓';
            lines.push(`| ${i + 1} | ${icon} | ${f.type} | \`${f.endpoint.length > 50 ? f.endpoint.substring(0, 50) + '...' : f.endpoint}\` |`);
        }
        lines.push('');

        lines.push('## 🔍 Technical Evidence & Remediation');

        const groups = {};
        for (const f of sorted) {
            const groupKey = `${f.type}|${f.parameter || 'N/A'}`;
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(f);
        }

        let catIndex = 1;
        for (const [groupKey, findings] of Object.entries(groups)) {
            const first = findings[0];
            const [type, parameter] = groupKey.split('|');
            const icon = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🔵', Info: '⚪' }[first.severity] || '❓';

            lines.push(`### ${catIndex++}. ${type}${parameter !== 'N/A' ? ' (' + parameter + ')' : ''} [${icon} ${first.severity}]`);
            lines.push(`**Description**: ${first.description}`);

            lines.push('| Endpoint | Proof / Evidence |');
            lines.push('|---|---|');

            const displayLimit = 6;
            findings.slice(0, displayLimit).forEach(f => {
                const evidenceBrief = f.evidence.length > 70
                    ? f.evidence.substring(0, 70).replace(/\n/g, ' ') + '...'
                    : f.evidence.replace(/\n/g, ' ');
                lines.push(`| \`${f.endpoint}\` | \`${evidenceBrief}\` |`);
            });
            if (findings.length > displayLimit) lines.push(`| ... | *+ ${findings.length - displayLimit} more* |`);
            lines.push('');

            if (first.remediation) {
                lines.push(`**Fix & Simulation:**`);
                lines.push(`${first.remediation.trim()}`);
            } else if (first.reproductionSteps?.length > 0) {
                lines.push(`**Reproduction:**`);
                first.reproductionSteps.slice(0, 2).forEach(step => lines.push(`- ${step}`));
            }
            lines.push('---\n');
        }
    }

    if (report.recommendations?.length > 0) {
        lines.push('## 💡 Key Recommendations');
        report.recommendations.forEach(rec => lines.push(`- ${rec}`));
        lines.push('');
    }

    lines.push('*Generated by VulnSight-AI — Agentic Security Auditor*');
    return lines.join('\n');
}

module.exports = { createScanFolder, generateReport };
