/**
 * REPORT GENERATOR TOOLS  v2 — Premium UI
 * Compiles all findings into a structured JSON report and renders
 * a world-class interactive HTML security report for VS Code webview.
 *
 * Features:
 * - Summary dashboard with risk meter + severity donut chart
 * - Attack Chain explorer
 * - Filterable, sortable findings table with expandable rows
 * - Per-category breakdown cards
 * - Top vulnerable files heatmap
 * - Agent pipeline logs timeline
 * - PoC payload viewer
 * - Fix recommendations with code diffs
 */

'use strict';

const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
function sevColor(sev) { return { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#3b82f6', INFO: '#8b5cf6' }[sev] ; '#64748b'; }
function sevGlow(sev)  { return { CRITICAL: '0 0 12px rgba(239,68,68,.35)', HIGH: '0 0 12px rgba(249,115,22,.3)', MEDIUM: '0 0 10px rgba(245,158,11,.25)', LOW: '0 0 10px rgba(59,130,246,.25)', INFO: '0 0 10px rgba(139,92,246,.2)' }[sev] ; 'none'; }
function owaspColor(o) { const map = { A01: '#e53e3e', A02: '#d97706', A03: '#7c3aed', A04: '#2563eb', A05: '#0891b2', A06: '#dc2626', A07: '#c026d3', A08: '#ea580c', A09: '#16a34a', A10: '#b45309' }; return map[(o||'').slice(0,3)] || '#64748b'; }
function srcIcon(src)  { return { 'Pattern Scan':'','Secret Scan':'','AST Scan':'','Dependency Audit':'','LLM Analysis':'','Auth Analysis':'','Business Logic':'','API Security':'','Frontend Security':'','Infrastructure':'','Cryptography':'','Logging & Monitoring':'','CI/CD Security':'' }[src] ; ''; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

//  Tool 1: Build structured JSON report 
const buildReportTool = new DynamicStructuredTool({
  name: 'build_report',
  description: 'Consolidate all vulnerability findings into a single structured JSON report.',
  schema: z.object({
    targetPath:       z.string(),
    patternFindings:  z.array(z.any()).optional().default([]),
    secretFindings:   z.array(z.any()).optional().default([]),
    astFindings:      z.array(z.any()).optional().default([]),
    depFindings:      z.array(z.any()).optional().default([]),
    llmFindings:      z.array(z.any()).optional().default([]),
    authFindings:     z.array(z.any()).optional().default([]),
    bizFindings:      z.array(z.any()).optional().default([]),
    apiFindings:      z.array(z.any()).optional().default([]),
    frontendFindings: z.array(z.any()).optional().default([]),
    infraFindings:    z.array(z.any()).optional().default([]),
    cryptoFindings:   z.array(z.any()).optional().default([]),
    loggingFindings:  z.array(z.any()).optional().default([]),
    agentLogs:        z.array(z.string()).optional().default([]),
    scanDurationMs:   z.number().optional().default(0),
  }),
  func: async (input) => {
    const { targetPath, patternFindings, secretFindings, astFindings, depFindings, llmFindings,
            authFindings, bizFindings, apiFindings, frontendFindings, infraFindings,
            cryptoFindings, loggingFindings, agentLogs, scanDurationMs } = input;

    const allFindings = [
      ...patternFindings.map(f=>({...f,source:f.source||'Pattern Scan'})),
      ...secretFindings.map(f =>({...f,source:f.source||'Secret Scan'})),
      ...astFindings.map(f    =>({...f,source:f.source||'AST Scan'})),
      ...depFindings.map(f    =>({...f,source:f.source||'Dependency Audit'})),
      ...llmFindings.map(f    =>({...f,source:f.source||'LLM Analysis'})),
      ...authFindings.map(f   =>({...f,source:f.source||'Auth Analysis'})),
      ...bizFindings.map(f    =>({...f,source:f.source||'Business Logic'})),
      ...apiFindings.map(f    =>({...f,source:f.source||'API Security'})),
      ...frontendFindings.map(f=>({...f,source:f.source||'Frontend Security'})),
      ...infraFindings.map(f  =>({...f,source:f.source||'Infrastructure'})),
      ...cryptoFindings.map(f =>({...f,source:f.source||'Cryptography'})),
      ...loggingFindings.map(f=>({...f,source:f.source||'Logging & Monitoring'})),
    ];

    const seen = new Set();
    const unique = allFindings.filter(f => {
      const key = `${f.file||''}:${f.line||0}:${(f.ruleId||f.category||f.description||'').slice(0,40)}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
    unique.sort((a,b)=>(SEV_ORDER[a.severity]??5)-(SEV_ORDER[b.severity]??5));

    const bySeverity={CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0,INFO:0},byCategory={},bySource={},byFile={},byOwasp={};
    for (const f of unique) {
      const sev=f.severity||'INFO'; bySeverity[sev]=(bySeverity[sev]||0)+1;
      const cat=f.category||'Uncategorized'; byCategory[cat]=(byCategory[cat]||0)+1;
      const src=f.source||'Unknown'; bySource[src]=(bySource[src]||0)+1;
      const file=f.file||'unknown'; if(!byFile[file])byFile[file]=[]; byFile[file].push(f);
      const owasp=(f.owasp||'Unknown').slice(0,7); byOwasp[owasp]=(byOwasp[owasp]||0)+1;
    }
    const riskScore=Math.min(100,bySeverity.CRITICAL*25+bySeverity.HIGH*10+bySeverity.MEDIUM*3+bySeverity.LOW*1);
    const riskLevel=riskScore>=75?'CRITICAL':riskScore>=50?'HIGH':riskScore>=25?'MEDIUM':'LOW';

    return JSON.stringify({
      meta:{ targetPath, generatedAt:new Date().toISOString(), scanDurationMs, scanner:'Vulentry — Multi-Agent Security Scanner v2', model:'Mistral AI (LangGraph Orchestration)', agentCount:10 },
      summary:{ totalFindings:unique.length, riskScore, riskLevel, bySeverity, byCategory, bySource, byOwasp,
        topVulnerableFiles:Object.entries(byFile).sort(([,a],[,b])=>b.length-a.length).slice(0,10).map(([file,findings])=>({file,count:findings.length,topSeverity:findings[0]?.severity||'INFO'})) },
      findings:unique, byFile, agentLogs,
    });
  },
});

//  Tool 2: Render Premium HTML report 
const renderHtmlReportTool = new DynamicStructuredTool({
  name: 'render_html_report',
  description: 'Render a world-class interactive HTML security audit report.',
  schema: z.object({ report: z.any() }),
  func: async ({ report }) => {
    const r = typeof report === 'string' ? JSON.parse(report) : report;
    const { meta, summary, findings, agentLogs } = r;
    const rc  = sevColor(summary.riskLevel);
    const now = new Date(meta.generatedAt).toLocaleString('en-US',{dateStyle:'long',timeStyle:'short'});
    const dur = (meta.scanDurationMs/1000).toFixed(1);

    function donutSvg(vals,colors,size=90,stroke=16){
      const total=vals.reduce((a,b)=>a+b,0);
      if(!total) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${(size-stroke)/2}" fill="none" stroke="#334155" stroke-width="${stroke}"/></svg>`;
      const r2=(size-stroke)/2,circ=2*Math.PI*r2;let off=0;
      const segs=vals.map((v,i)=>{const p=v/total,d=p*circ,g=circ-d,s=`<circle cx="${size/2}" cy="${size/2}" r="${r2}" fill="none" stroke="${colors[i]}" stroke-width="${stroke}" stroke-dasharray="${d.toFixed(2)} ${g.toFixed(2)}" stroke-dashoffset="${(-off*circ).toFixed(2)}" transform="rotate(-90 ${size/2} ${size/2})"/>`;off+=p;return s;});
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${segs.join('')}</svg>`;
    }

    const donut = donutSvg(['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(s=>summary.bySeverity[s]||0),['#ef4444','#f97316','#f59e0b','#3b82f6','#8b5cf6']);

    const sourceChips=Object.entries(summary.bySource||{}).sort(([,a],[,b])=>b-a).map(([src,n])=>
      `<div class="sc"><span>${srcIcon(src)}</span><span class="sc-name">${esc(src)}</span><span class="sc-n">${n}</span></div>`).join('');

    const owaspCards=Object.entries(summary.byOwasp||{}).sort(([,a],[,b])=>b-a).slice(0,8).map(([o,n])=>
      `<div class="ow" style="border-left:3px solid ${owaspColor(o)}"><div class="ow-id" style="color:${owaspColor(o)}">${esc(o)}</div><div class="ow-n">${n}</div></div>`).join('');

    const fileRows=(summary.topVulnerableFiles||[]).map((f,i)=>{
      const display=f.file.replace(/\\/g,'/').split('/').slice(-3).join('/');
      const bar=Math.round(f.count/(summary.topVulnerableFiles[0]?.count||1)*100);
      return `<tr class="fr"><td class="fr-r">${i+1}</td><td class="fr-p" title="${esc(f.file)}">${esc(display)}</td><td><div class="bw"><div class="bf" style="width:${bar}%;background:${sevColor(f.topSeverity)}"></div></div></td><td class="fr-c" style="color:${sevColor(f.topSeverity)}">${f.count}</td></tr>`;}).join('');

    const catCards=Object.entries(summary.byCategory||{}).sort(([,a],[,b])=>b-a).map(([cat,n])=>{
      const topSev=['CRITICAL','HIGH','MEDIUM','LOW','INFO'].find(s=>findings.some(f=>(f.category||f.name)===cat&&f.severity===s))||'INFO';
      return `<div class="cc" style="border-top:3px solid ${sevColor(topSev)}"><div class="cc-name">${esc(cat)}</div><div class="cc-n" style="color:${sevColor(topSev)}">${n}</div><span class="sm" style="background:${sevColor(topSev)}">${topSev}</span></div>`;}).join('');

    const findingRows=findings.map((f,i)=>{
      const sev=f.severity||'INFO',cat=esc(f.category||f.name||'Unknown'),desc=esc(f.description||'');
      const file=esc((f.file||'').replace(/\\/g,'/').split('/').slice(-3).join('/'));
      const snippet=esc((f.snippet||f.match||'').slice(0,80).replace(/\n/g,' '));
      const poc=typeof f.poc==='object'?JSON.stringify(f.poc,null,2):String(f.poc||'');
      const fix=String(f.fix||'');
      return `<tr class="fr2" data-sev="${sev}" onclick="tog('r${i}')">
        <td class="ts"><span class="sb" style="background:${sevColor(sev)};box-shadow:${sevGlow(sev)}">${sev}</span></td>
        <td class="tc"><div class="cl">${cat}</div><div class="ri">${esc(f.ruleId||'')}</div></td>
        <td class="td2">${desc}</td>
        <td class="tf"><span class="fb" title="${esc(f.file||'')}">${file}</span>${f.line?`<span class="lb">L${f.line}</span>`:''}</td>
        <td class="tk"><code class="sk">${snippet}</code></td>
        <td class="tw"><span class="cw">${esc(f.cwe||'—')}</span></td>
        <td class="to"><span class="ow2" style="color:${owaspColor(f.owasp)}">${esc((f.owasp||'—').split(':')[0])}</span></td>
        <td class="ta"><span class="st">${srcIcon(f.source)} ${esc(f.source||'—')}</span></td>
      </tr>
      <tr class="er" id="r${i}"><td colspan="8" class="ec">
        <div class="ex">
          ${snippet?`<div class="es"><div class="el"> Vulnerable Code</div><pre class="cb">${esc((f.snippet||f.match||'').slice(0,400))}</pre></div>`:''}
          ${poc?`<div class="es"><div class="el poc-l"> Proof of Concept</div><pre class="pb">${esc(poc)}</pre></div>`:''}
          ${fix?`<div class="es"><div class="el fix-l"> Recommended Fix</div><pre class="xb">${esc(fix)}</pre></div>`:''}
          ${f.cwe?`<div class="em"><span class="mp" style="background:#1e1b4b;color:#a78bfa">${esc(f.cwe)}</span><span class="mp" style="background:#eff6ff;color:#2563eb">${esc(f.owasp||'')}</span><span class="mp" style="background:#0f172a;color:#94a3b8">${srcIcon(f.source)} ${esc(f.source||'')}</span></div>`:''}
        </div>
      </td></tr>`;}).join('');

    const logLines=(agentLogs||[]).map(l=>{
      const c=/error|failed/i.test(l)?'#ef4444':/warning|skip/i.test(l)?'#f59e0b':/complete|done|found/i.test(l)?'#22c55e':'#94a3b8';
      return `<div style="color:${c};font-size:11px;padding:2px 0;border-bottom:1px solid #1e293b40;line-height:1.6">${esc(l)}</div>`;}).join('');

    const hasCritical=(summary.bySeverity.CRITICAL||0)>0;

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vulentry Security Report</title><style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f172a;--s1:#1e293b;--s2:#263447;--bd:#334155;--tx:#f1f5f9;--t2:#94a3b8;--t3:#64748b;--ac:#6366f1;--r:10px;--rs:6px}
html{font-size:14px;scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh;line-height:1.5}
code{font-family:'JetBrains Mono','Fira Code',monospace;font-size:12px}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--s1)}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
/* Header */
.hdr{background:linear-gradient(135deg,#0a0f1e,#1a2035,#0d1929);border-bottom:1px solid var(--bd);padding:24px 36px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.hdr h1{font-size:21px;font-weight:900;background:linear-gradient(135deg,#6366f1,#a78bfa,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hdr .sub{font-size:11px;color:var(--t3);margin-top:3px}
.hdr .meta{font-size:11px;color:var(--t3);display:flex;gap:14px;flex-wrap:wrap;margin-top:10px}
.rp{padding:8px 22px;border-radius:30px;font-weight:900;font-size:15px;color:#fff;letter-spacing:.5px}
/* Layout */
.wrap{max-width:1500px;margin:0 auto;padding:24px 28px}
/* Section */
.sec{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);margin-bottom:20px;overflow:hidden}
.sh{padding:14px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between}
.sh h2{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
/* Cards */
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px}
.card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px;transition:.2s}
.card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.cl2{font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.7px;font-weight:600}
.cv{font-size:32px;font-weight:900;margin-top:4px;line-height:1}
.cs{font-size:11px;color:var(--t3);margin-top:3px}
/* Risk */
.dgw{position:relative;display:inline-block}
.dc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:${rc}}
.sb2{height:5px;border-radius:3px;background:var(--bd);overflow:hidden;margin-top:7px}
.sf{height:100%;border-radius:3px;background:${rc};transition:width 1.2s ease}
/* Source chips */
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:14px 20px}
.sc{display:flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--bd);border-radius:20px;padding:4px 10px;font-size:12px}
.sc-name{color:var(--t2)}.sc-n{background:var(--ac);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700}
/* OWASP */
.og{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;padding:14px 20px}
.ow{background:var(--s2);border-radius:var(--rs);padding:10px;text-align:center}
.ow-id{font-size:10px;font-weight:700;margin-bottom:3px}
.ow-n{font-size:20px;font-weight:900}
/* Files */
.ft{width:100%;border-collapse:collapse}
.fr{border-bottom:1px solid var(--bd);transition:.2s}
.fr:hover{background:var(--s2)}
.fr-r{padding:9px 10px;color:var(--t3);font-size:10px;width:28px;font-weight:700}
.fr-p{padding:9px 10px;font-family:monospace;font-size:11px;color:var(--t2);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bw{background:var(--bd);border-radius:3px;height:5px;width:100px;overflow:hidden}
.bf{height:100%;border-radius:3px}
.fr-c{padding:9px 12px;font-weight:900;font-size:13px;text-align:right}
/* Cat cards */
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:9px;padding:14px 20px}
.cc{background:var(--s2);border-radius:var(--rs);padding:12px;transition:.2s}
.cc:hover{transform:translateY(-1px)}
.cc-name{font-size:11px;color:var(--t2);font-weight:600;line-height:1.3;margin-bottom:5px}
.cc-n{font-size:24px;font-weight:900;line-height:1}
.sm{font-size:10px;font-weight:700;color:#fff;padding:1px 7px;border-radius:10px;margin-top:5px;display:inline-block}
/* Summary grid */
.sg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}
@media(max-width:1100px){.sg{grid-template-columns:1fr 1fr}}@media(max-width:700px){.sg{grid-template-columns:1fr}}
/* Filter */
.fb2{display:flex;gap:8px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--bd);background:var(--s2);align-items:center}
.fn{padding:4px 12px;border-radius:20px;border:1px solid var(--bd);background:transparent;color:var(--t2);font-size:11px;cursor:pointer;transition:.2s;font-weight:600}
.fn:hover,.fn.act{background:var(--ac);border-color:var(--ac);color:#fff}
.fs{flex:1;min-width:180px;padding:5px 10px;background:var(--s1);border:1px solid var(--bd);border-radius:var(--rs);color:var(--tx);font-size:12px;outline:none}
.fs:focus{border-color:var(--ac)}
/* Findings table */
.ft2{width:100%;border-collapse:collapse}
.ft2 th{padding:9px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--t3);background:var(--s2);border-bottom:1px solid var(--bd);font-weight:700;white-space:nowrap}
.fr2{border-bottom:1px solid #334155aa;cursor:pointer;transition:.15s}
.fr2:hover{background:var(--s2)}
.ts{padding:9px 10px;width:85px}.tc{padding:9px 10px;min-width:130px}.td2{padding:9px 10px;color:var(--t2);font-size:12px;max-width:260px}
.tf{padding:9px 10px;min-width:150px}.tk{padding:9px 10px;max-width:160px;overflow:hidden}
.tw,.to,.ta{padding:9px 10px;white-space:nowrap}
.sb{display:inline-block;color:#fff;padding:3px 9px;border-radius:12px;font-size:10px;font-weight:900;letter-spacing:.3px;white-space:nowrap}
.cl{font-size:12px;font-weight:600}.ri{font-size:10px;color:var(--t3);margin-top:1px;font-family:monospace}
.fb3{font-family:monospace;font-size:11px;color:var(--t3);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}
.lb{font-size:10px;background:var(--s2);border:1px solid var(--bd);border-radius:3px;padding:1px 4px;color:#818cf8;margin-top:2px;display:inline-block}
.sk{color:#86efac;font-size:11px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px}
.cw{font-size:10px;background:#1e1b4b;color:#a78bfa;border-radius:4px;padding:2px 5px;font-family:monospace}
.ow2{font-size:10px;font-weight:700;padding:2px 5px;background:var(--s2);border-radius:4px}
.st{font-size:11px;color:var(--t3);white-space:nowrap}
/* Expand */
.er{display:none}.er.op{display:table-row}.ec{padding:0!important}
.ex{background:linear-gradient(135deg,#0a1628,#111d2e);border-bottom:1px solid var(--bd);padding:18px 22px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:800px){.ex{grid-template-columns:1fr}}
.es{display:flex;flex-direction:column;gap:6px}
.el{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--t3)}
.poc-l{color:#ef4444}.fix-l{color:#22c55e}
.cb{background:#060d1a;border:1px solid var(--bd);border-radius:var(--rs);padding:10px;font-size:11px;color:#86efac;overflow-x:auto;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto}
.pb{background:#1a0808;border:1px solid #7f1d1d;border-radius:var(--rs);padding:10px;font-size:11px;color:#fca5a5;overflow-x:auto;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto}
.xb{background:#021a0a;border:1px solid #14532d;border-radius:var(--rs);padding:10px;font-size:11px;color:#86efac;overflow-x:auto;white-space:pre-wrap;word-break:break-word;max-height:160px;overflow-y:auto}
.em{display:flex;gap:6px;flex-wrap:wrap;align-items:center;grid-column:1/-1}
.mp{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600}
/* Chain */
.ch{display:flex;gap:0;overflow-x:auto;padding:14px 20px;align-items:stretch}
.cs2{flex:1;min-width:120px;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rs);padding:12px;text-align:center;position:relative}
.cs2:not(:last-child){margin-right:22px}.cs2:not(:last-child)::after{content:'→';position:absolute;right:-12px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:14px;background:var(--bg);padding:0 1px}
.ci{font-size:22px;margin-bottom:5px}.ct{font-size:10px;font-weight:700;color:var(--tx);margin-bottom:3px}.cd{font-size:9px;color:var(--t3)}
/* Log */
.lt{background:#060d1a;border-radius:var(--rs);padding:14px;max-height:260px;overflow-y:auto;font-family:monospace}
/* Misc */
.bdn{padding:28px;text-align:center;color:var(--t3);font-size:13px}
.bc{background:var(--ac);color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px}
.exec-txt{padding:18px 22px;font-size:13px;color:var(--t2);line-height:1.8;white-space:pre-wrap;border-left:3px solid var(--ac);background:linear-gradient(90deg,#1e293b40,transparent)}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.sec{animation:fadeIn .25s ease}
</style></head><body>

<div class="hdr">
  <div>
    <h1> Vulentry Security Audit Report</h1>
    <div class="sub">Multi-Agent AI Security Scanner  10 Specialized Agents</div>
    <div class="meta"><span> ${esc(meta.targetPath)}</span><span> ${now}</span><span> ${dur}s</span><span> ${esc(meta.scanner)}</span></div>
  </div>
  <div style="text-align:center">
    <div style="font-size:10px;color:var(--t3);margin-bottom:5px">OVERALL RISK</div>
    <span class="rp" style="background:${rc};box-shadow:0 0 20px ${rc}55">${summary.riskLevel}</span>
  </div>
</div>

<div class="wrap">

<!-- Summary Cards -->
<div class="cards">
  <div class="card" style="grid-column:span 2;border-color:${rc}44">
    <div style="display:flex;align-items:center;gap:16px">
      <div><div class="dgw">${donut}<div class="dc">${summary.riskScore}</div></div></div>
      <div style="flex:1">
        <div class="cl2">Risk Score</div>
        <div class="cv" style="color:${rc}">${summary.riskScore}<span style="font-size:14px;color:var(--t3)">/100</span></div>
        <div class="sb2"><div class="sf" style="width:${summary.riskScore}%"></div></div>
        <div style="display:flex;gap:10px;margin-top:8px;font-size:11px;flex-wrap:wrap">
          ${['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(s=>`<span style="color:${sevColor(s)};font-weight:700">${s.charAt(0)+s.slice(1).toLowerCase()} <b style="font-size:15px">${summary.bySeverity[s]||0}</b></span>`).join('')}
        </div>
      </div>
    </div>
  </div>
  <div class="card"><div class="cl2">Total</div><div class="cv">${summary.totalFindings}</div><div class="cs">findings</div></div>
  <div class="card"><div class="cl2">Critical</div><div class="cv" style="color:#ef4444">${summary.bySeverity.CRITICAL||0}</div><div class="cs">act now</div></div>
  <div class="card"><div class="cl2">High</div><div class="cv" style="color:#f97316">${summary.bySeverity.HIGH||0}</div><div class="cs">fix soon</div></div>
  <div class="card"><div class="cl2">Medium</div><div class="cv" style="color:#f59e0b">${summary.bySeverity.MEDIUM||0}</div><div class="cs">plan fix</div></div>
  <div class="card"><div class="cl2">Low</div><div class="cv" style="color:#3b82f6">${summary.bySeverity.LOW||0}</div><div class="cs">track</div></div>
  <div class="card"><div class="cl2">Agents</div><div class="cv" style="color:#8b5cf6">${meta.agentCount||10}</div><div class="cs">specialized</div></div>
</div>

${hasCritical?`<div class="sec"><div class="sh"><h2> Potential Exploit Chain</h2><span style="font-size:10px;color:var(--t3)">How flaws combine into a full compromise</span></div>
<div class="ch">
  <div class="cs2"><div class="ci"></div><div class="ct">Recon</div><div class="cd">Exposed routes, GraphQL, error leakage</div></div>
  <div class="cs2"><div class="ci"></div><div class="ct">Initial Access</div><div class="cd">Weak JWT, missing auth, hardcoded creds</div></div>
  <div class="cs2"><div class="ci"></div><div class="ct">Priv Escalation</div><div class="cd">IDOR, mass assignment, RBAC bypass</div></div>
  <div class="cs2"><div class="ci"></div><div class="ct">Exploitation</div><div class="cd">SQLi / CMDi / XSS execution</div></div>
  <div class="cs2"><div class="ci"></div><div class="ct">Exfiltration</div><div class="cd">Excessive data, unbounded queries, dump</div></div>
  <div class="cs2"><div class="ci"></div><div class="ct">Persistence</div><div class="cd">Infra misconfiguration, no audit logs</div></div>
</div></div>`:''}

${r.executiveSummary?`<div class="sec"><div class="sh"><h2> Executive Summary</h2></div><div class="exec-txt">${esc(r.executiveSummary)}</div></div>`:''}

<div class="sec"><div class="sh"><h2> Agent Coverage</h2><span style="font-size:10px;color:var(--t3)">Findings by scan agent</span></div>
<div class="chips">${sourceChips||'<div style="padding:8px;color:var(--t3);font-size:12px">No data</div>'}</div></div>

<div class="sg">
  <div class="sec"><div class="sh"><h2> OWASP Mapping</h2></div><div class="og">${owaspCards||'<div style="padding:10px;color:var(--t3);font-size:11px">No data</div>'}</div></div>
  <div class="sec"><div class="sh"><h2> Most Vulnerable Files</h2></div><table class="ft">${fileRows||'<tr><td class="bdn" colspan="4">No data</td></tr>'}</table></div>
  <div class="sec"><div class="sh"><h2> Vulnerability Categories</h2></div><div class="cg">${catCards||'<div style="padding:10px;color:var(--t3);font-size:11px">No data</div>'}</div></div>
</div>

<div class="sec">
  <div class="sh"><h2> All Findings<span class="bc">${summary.totalFindings}</span></h2><span style="font-size:10px;color:var(--t3)">Click row  expand PoC + fix</span></div>
  <div class="fb2">
    <span style="font-size:11px;color:var(--t3);font-weight:600">Filter:</span>
    <button class="fn act" onclick="fSev(this,'ALL')">All</button>
    ${['CRITICAL','HIGH','MEDIUM','LOW','INFO'].map(s=>`<button class="fn" onclick="fSev(this,'${s}')" style="color:${sevColor(s)}">${s} (${summary.bySeverity[s]||0})</button>`).join('')}
    <input class="fs" id="srch" placeholder=" Search findings" oninput="fSrch(this.value)">
    <span style="font-size:11px;color:var(--t3);margin-left:auto" id="rc2">${findings.length} findings</span>
  </div>
  <div style="overflow-x:auto">
    <table class="ft2"><thead><tr>
      <th>Severity</th><th>Category</th><th>Description</th><th>File</th><th>Snippet</th><th>CWE</th><th>OWASP</th><th>Agent</th>
    </tr></thead>
    <tbody id="tb">${findingRows||'<tr><td colspan="8" class="bdn"> No vulnerabilities detected</td></tr>'}</tbody></table>
  </div>
</div>

<div class="sec"><div class="sh"><h2> Agent Pipeline Logs</h2></div>
<div style="padding:12px 20px"><div class="lt">${logLines||'<span style="color:var(--t3)">No logs</span>'}</div></div></div>

<div style="text-align:center;padding:16px;color:var(--t3);font-size:10px">
  Vulentry Multi-Agent Security Scanner  Mistral AI + LangGraph  ${now}
</div>
</div>

<script>
function tog(id){const r=document.getElementById(id);if(r)r.classList.toggle('op')}
let aS='ALL',aQ='';
function fSev(btn,s){aS=s;document.querySelectorAll('.fn').forEach(b=>b.classList.remove('act'));btn.classList.add('act');af()}
function fSrch(v){aQ=v.toLowerCase();af()}
function af(){const rows=document.querySelectorAll('#tb .fr2');let n=0;rows.forEach(row=>{const s=row.dataset.sev||'',t=row.textContent.toLowerCase();const show=(aS==='ALL'||s===aS)&&(!aQ||t.includes(aQ));row.style.display=show?'':'none';const nx=row.nextElementSibling;if(nx&&nx.classList.contains('er')){if(!show)nx.classList.remove('op');nx.style.display=show?'':'none'}if(show)n++;});const el=document.getElementById('rc2');if(el)el.textContent=n+' findings';}
</script>
</body></html>`;
  },
});

module.exports = { buildReportTool, renderHtmlReportTool };
