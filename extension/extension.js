'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');
<<<<<<< HEAD
=======
const http   = require('http');
const https  = require('https');
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe

// Lazy-load the orchestrator (may need deps installed)
let runSecurityScan;
function getOrchestrator() {
  if (!runSecurityScan) {
    try {
      runSecurityScan = require('./agents/orchestratorAgent').runSecurityScan;
    } catch (e) {
      throw new Error(
        `Failed to load orchestrator: ${e.message}\n\nPlease run "npm install" in the extension folder first.`
      );
    }
  }
  return runSecurityScan;
}

// ─── Get config from VS Code settings ─────────────────────────────────────────
function getConfig() {
<<<<<<< HEAD
  const cfg = vscode.workspace.getConfiguration('vulentry');
=======
  const cfg = vscode.workspace.getConfiguration('zerotrace');
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  return {
    apiKey:        cfg.get('mistralApiKey') || process.env.MISTRAL_API_KEY || '',
    model:         cfg.get('mistralModel')  || 'mistral-large-latest',
    maxFileSizeKB: cfg.get('maxFileSizeKB') || 200,
    extensions:    cfg.get('fileExtensions'),
  };
}

<<<<<<< HEAD
// ─── Create / reveal a loading webview panel ──────────────────────────────────
function createLoadingPanel(context) {
  const panel = vscode.window.createWebviewPanel(
    'vulentryReport',
    '🔍 Vulentry — Scanning...',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getLoadingHtml();
=======
// ─── Nonce helper (for CSP) ───────────────────────────────────────────────────
function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Dashboard connection helpers ─────────────────────────────────────────────

/** Minimal HTTP/HTTPS request helper — no external deps needed. */
function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod    = parsed.protocol === 'https:' ? https : http;
    const bodyStr = body
      ? (typeof body === 'string' ? body : JSON.stringify(body))
      : null;
    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  { ...(options.headers || {}) },
    };
    if (bodyStr) reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = mod.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function getDashboardConfig() {
  const cfg = vscode.workspace.getConfiguration('zerotrace');
  return {
    serverUrl: (cfg.get('dashboardUrl') || 'http://localhost:5000').replace(/\/$/, ''),
    email:     cfg.get('dashboardEmail') || '',
    password:  cfg.get('dashboardPassword') || '',
  };
}

const SECRETS_TOKEN_KEY = 'zerotrace.dashboardToken';

// ─── Dashboard status bar (persistent across scans) ───────────────────────────
let _statusBar = null;   // set in activate()

function initStatusBar(context) {
  _statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
  _statusBar.command   = 'zerotrace.checkDashboardStatus';
  _statusBar.tooltip   = 'ZeroTrace Dashboard — click for status / connect';
  setDashboardStatus('disconnected');
  _statusBar.show();
  context.subscriptions.push(_statusBar);
}

/**
 * @param {'disconnected'|'connecting'|'connected'|'uploading'|'sent'|'failed'} state
 * @param {string} [extra]    
 */
function setDashboardStatus(state, extra) {
  if (!_statusBar) return;
  const map = {
    disconnected: { icon: '$(plug)',         text: 'Dashboard: not connected',  color: undefined },
    connecting:   { icon: '$(sync~spin)',    text: 'Dashboard: connecting…',    color: undefined },
    connected:    { icon: '$(check)',        text: 'Dashboard: connected',      color: new vscode.ThemeColor('statusBarItem.prominentForeground') },
    uploading:    { icon: '$(cloud-upload)', text: 'Dashboard: uploading…',     color: undefined },
    sent:         { icon: '$(cloud)',        text: 'Dashboard: report sent ✓',  color: new vscode.ThemeColor('statusBarItem.prominentForeground') },
    failed:       { icon: '$(warning)',      text: 'Dashboard: upload failed',  color: new vscode.ThemeColor('statusBarItem.errorForeground') },
  };
  const s = map[state] || map.disconnected;
  _statusBar.text  = `${s.icon} ${s.text}${extra ? ' — ' + extra : ''}`;
  _statusBar.color = s.color;
}

async function loginToDashboard(serverUrl, email, password) {
  try {
    const res = await httpRequest(
      `${serverUrl}/api/auth/login`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email, password }
    );
    if (res.status === 200 && res.body?.token) return { token: res.body.token, error: null };
    return { token: null, error: res.body?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { token: null, error: e.message };
  }
}

/**
 * Returns a valid JWT token for the dashboard, prompting the user if needed.
 * Returns null if the user cancels or login fails.
 */
async function getDashboardToken(context) {
  // 1. Try cached token
  const cached = await context.secrets.get(SECRETS_TOKEN_KEY);
  if (cached) { setDashboardStatus('connected'); return cached; }

  setDashboardStatus('connecting');

  // 2. Try settings-based auto-login
  const dashCfg = getDashboardConfig();
  if (dashCfg.email && dashCfg.password) {
    const { token, error } = await loginToDashboard(dashCfg.serverUrl, dashCfg.email, dashCfg.password);
    if (token) {
      await context.secrets.store(SECRETS_TOKEN_KEY, token);
      setDashboardStatus('connected');
      return token;
    }
    console.warn('[ZeroTrace] Settings auto-login failed:', error);
  }

  // 3. Prompt the user interactively
  const serverUrl = await vscode.window.showInputBox({
    prompt: 'ZeroTrace Dashboard — Server URL',
    value: dashCfg.serverUrl || 'http://localhost:5000',
    ignoreFocusOut: true,
  });
  if (!serverUrl) { setDashboardStatus('disconnected'); return null; }

  const email = await vscode.window.showInputBox({
    prompt: 'ZeroTrace Dashboard — Email',
    value: dashCfg.email || '',
    ignoreFocusOut: true,
  });
  if (!email) { setDashboardStatus('disconnected'); return null; }

  const password = await vscode.window.showInputBox({
    prompt: 'ZeroTrace Dashboard — Password',
    password: true,
    ignoreFocusOut: true,
  });
  if (!password) { setDashboardStatus('disconnected'); return null; }

  const { token, error } = await loginToDashboard(serverUrl, email, password);
  if (token) {
    await context.secrets.store(SECRETS_TOKEN_KEY, token);
    setDashboardStatus('connected');
    vscode.window.showInformationMessage('ZeroTrace: Connected to dashboard ✓');
    return token;
  }

  setDashboardStatus('failed', error || 'Login failed');
  vscode.window.showWarningMessage(`ZeroTrace: Dashboard login failed — ${error || 'bad credentials'}`);
  return null;
}

/**
 * Upload the generated HTML report to the backend dashboard.
 * Returns true on success, false on failure.
 */
async function uploadReportToDashboard(context, { htmlReport, targetPath, summary }) {
  const dashCfg   = getDashboardConfig();
  const serverUrl = dashCfg.serverUrl;

  setDashboardStatus('connecting');
  let token = await getDashboardToken(context);
  if (!token) {
    setDashboardStatus('disconnected');
    return false;
  }

  // Sanity-check the payload size before sending
  const payloadBytes = Buffer.byteLength(JSON.stringify({ htmlReport, targetPath, summary }));
  console.log(`[ZeroTrace] Upload payload: ${(payloadBytes / 1024).toFixed(1)} KB to ${serverUrl}`);
  setDashboardStatus('uploading', `${(payloadBytes / 1024).toFixed(0)} KB`);

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };
  const bodyStr = JSON.stringify({ htmlReport, targetPath, summary });

  async function doPost() {
    return httpRequest(
      `${serverUrl}/api/extension/reports`,
      { method: 'POST', headers },
      bodyStr
    );
  }

  try {
    let res = await doPost();
    console.log(`[ZeroTrace] Upload response: HTTP ${res.status}`, res.body);

    if (res.status === 413) {
      const errMsg = 'Server rejected upload: payload too large. Ensure the server has express.json({ limit: "50mb" })';
      console.error('[ZeroTrace]', errMsg);
      setDashboardStatus('failed', '413 too large');
      vscode.window.showErrorMessage(`ZeroTrace: ${errMsg}`);
      return false;
    }

    if (res.status === 401) {
      // Token expired — clear and retry once
      await context.secrets.delete(SECRETS_TOKEN_KEY);
      setDashboardStatus('connecting');
      token = await getDashboardToken(context);
      if (!token) { setDashboardStatus('disconnected'); return false; }
      headers['Authorization'] = `Bearer ${token}`;
      res = await doPost();
      console.log(`[ZeroTrace] Retry response: HTTP ${res.status}`, res.body);
    }

    if (res.status === 201) {
      setDashboardStatus('sent', path.basename(targetPath));
      return true;
    }

    const msg = res.body?.message || `HTTP ${res.status}`;
    console.error('[ZeroTrace] Upload failed:', msg);
    setDashboardStatus('failed', msg);
    vscode.window.showErrorMessage(`ZeroTrace: Upload failed — ${msg}`);
    return false;
  } catch (e) {
    console.error('[ZeroTrace] Dashboard upload error:', e.message, e.stack);
    setDashboardStatus('failed', e.message);
    vscode.window.showErrorMessage(`ZeroTrace: Upload error — ${e.message}`);
    return false;
  }
}

// ─── Upload HTML helpers ──────────────────────────────────────────────────────

/** Find the most-recently modified .html file in a directory (non-recursive). */
function findLatestHtmlInDir(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.html') || f.endsWith('.htm'))
      .map((f) => ({ file: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0].file : null;
  } catch {
    return null;
  }
}

/** Recursively collect all .zerotrace directories under a root path. */
function findZeroTraceDirs(root, results = [], depth = 0) {
  if (depth > 4) return results;
  try {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(root, e.name);
      if (e.name === '.zerotrace') {
        results.push(full);
      } else if (!e.name.startsWith('.') && e.name !== 'node_modules') {
        findZeroTraceDirs(full, results, depth + 1);
      }
    }
  } catch { /* permission denied or missing */ }
  return results;
}

function createLoadingPanel(context) {
  const panel = vscode.window.createWebviewPanel(
    'zerotraceReport',
    'ZeroTrace — Scanning...',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
    }
  );
  panel.webview.html = getLoadingHtml(panel.webview, context);
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  return panel;
}

// ─── Update webview with progress ─────────────────────────────────────────────
function updatePanelProgress(panel, stage, message) {
  panel.webview.postMessage({ type: 'progress', stage, message });
}

// ─── Set final report HTML ─────────────────────────────────────────────────────
function setPanelReport(panel, html, title) {
<<<<<<< HEAD
  panel.title = title || '🔍 Vulentry — Security Report';
=======
  panel.title = title || 'ZeroTrace — Security Report';
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  panel.webview.html = html;
}

// ─── Core scan runner ──────────────────────────────────────────────────────────
async function runScan(targetPath, context) {
  const config = getConfig();

  // Validate API key
  if (!config.apiKey) {
    const action = await vscode.window.showErrorMessage(
<<<<<<< HEAD
      'Vulentry: Mistral API key not configured.',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'vulentry.mistralApiKey');
=======
      'ZeroTrace: Mistral API key not configured.',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'zerotrace.mistralApiKey');
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    }
    return;
  }

  // Create output directory inside the scanned project
<<<<<<< HEAD
  const outputDir = path.join(targetPath, '.vulentry');
=======
  const outputDir = path.join(targetPath, '.zerotrace');
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}

  // Create webview panel
  const panel = createLoadingPanel(context);

  // Status bar progress
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
<<<<<<< HEAD
  statusItem.text = '$(sync~spin) Vulentry: Scanning...';
=======
  statusItem.text = '$(sync~spin) ZeroTrace: Scanning...';
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  statusItem.tooltip = 'Multi-agent security scan in progress';
  statusItem.show();

  const startTime = Date.now();

  try {
    const orchestrate = getOrchestrator();

    const result = await orchestrate({
      targetPath,
      apiKey:   config.apiKey,
      model:    config.model,
      options: {
        maxFileSizeKB:    config.maxFileSizeKB,
        extensions:       config.extensions,
        outputDir,
        maxFilesForLlm:   25,
      },
      onProgress: ({ stage, message, current, total }) => {
        const pct = total ? ` (${current}/${total})` : '';
        statusItem.text = `$(sync~spin) ${stage}${pct}`;
        updatePanelProgress(panel, stage, message || '');
<<<<<<< HEAD
        console.log(`[Vulentry] [${stage}] ${message || ''}${pct}`);
=======
        console.log(`[ZeroTrace] [${stage}] ${message || ''}${pct}`);
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
<<<<<<< HEAD
    statusItem.text = `$(shield) Vulentry: Done in ${elapsed}s`;

    if (result.htmlReport) {
      const summary = result.reportJson?.summary;
      const title   = `🔍 Vulentry — ${summary?.riskLevel || 'UNKNOWN'} Risk | ${summary?.totalFindings || 0} findings`;
      setPanelReport(panel, result.htmlReport, title);
=======
    statusItem.text = `$(shield) ZeroTrace: Done in ${elapsed}s`;

    if (result.htmlReport) {
      const logoUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', 'zerotrace.png')
      ).toString();
      const htmlWithLogo = result.htmlReport.replace(/\{\{LOGO_SRC\}\}/g, logoUri);
      const summary = result.reportJson?.summary;
      const title   = `ZeroTrace — ${summary?.riskLevel || 'UNKNOWN'} Risk | ${summary?.totalFindings || 0} findings`;
      setPanelReport(panel, htmlWithLogo, title);

      // Upload report to the dashboard (non-blocking, best-effort)
      // Use htmlWithLogo so the stored copy renders correctly
      uploadReportToDashboard(context, {
        htmlReport:  htmlWithLogo,
        targetPath,
        summary:     summary || {},
      }).then((saved) => {
        if (saved) {
          vscode.window.showInformationMessage('ZeroTrace: Report saved to dashboard ✓');
        }
      });
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe

      // Show notification
      const critical = summary?.bySeverity?.CRITICAL || 0;
      const high     = summary?.bySeverity?.HIGH     || 0;
      const msg      = `Security scan complete: ${summary?.totalFindings} findings (${critical} CRITICAL, ${high} HIGH). Risk: ${summary?.riskLevel}`;

      const action = await vscode.window.showWarningMessage(msg, 'Open Report', 'Save JSON');
      if (action === 'Save JSON' && result.jsonPath) {
        vscode.window.showInformationMessage(`Report saved: ${result.jsonPath}`);
        vscode.env.openExternal(vscode.Uri.file(result.jsonPath));
      } else if (action === 'Open Report' && result.htmlPath) {
        vscode.env.openExternal(vscode.Uri.file(result.htmlPath));
      }
    } else {
<<<<<<< HEAD
      panel.webview.html = getErrorHtml('Report generation failed. Check the Vulentry output console.');
=======
      // Fallback: try to find an HTML report that the orchestrator wrote to disk
      let diskHtml = null;
      if (result.htmlPath) {
        try { diskHtml = fs.readFileSync(result.htmlPath, 'utf8'); } catch { /* ignore */ }
      }
      if (!diskHtml && targetPath) {
        // Look in .zerotrace subdirs near the scan root
        const roots = [targetPath, path.dirname(targetPath)];
        for (const r of roots) {
          const dirs = findZeroTraceDirs(r);
          for (const d of dirs) {
            diskHtml = diskHtml || (findLatestHtmlInDir(d) && (() => {
              try { return fs.readFileSync(findLatestHtmlInDir(d), 'utf8'); } catch { return null; }
            })());
          }
          if (diskHtml) break;
        }
      }
      if (diskHtml) {
        const logoUri = panel.webview.asWebviewUri(
          vscode.Uri.joinPath(context.extensionUri, 'media', 'zerotrace.png')
        ).toString();
        const htmlWithLogo = diskHtml.replace(/\{\{LOGO_SRC\}\}/g, logoUri);
        setPanelReport(panel, htmlWithLogo, 'ZeroTrace Report');
        uploadReportToDashboard(context, { htmlReport: htmlWithLogo, targetPath, summary: {} });
      } else {
        panel.webview.html = getErrorHtml(panel.webview, context, 'Report generation failed. Check the ZeroTrace output console.');
      }
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    }

    // Log errors if any
    if (result.errors?.length > 0) {
<<<<<<< HEAD
      result.errors.forEach((e) => console.error(`[Vulentry] Error: ${e}`));
    }

  } catch (e) {
    statusItem.text = '$(error) Vulentry: Error';
    panel.webview.html = getErrorHtml(e.message);
    vscode.window.showErrorMessage(`Vulentry scan failed: ${e.message}`);
    console.error('[Vulentry]', e);
=======
      result.errors.forEach((e) => console.error(`[ZeroTrace] Error: ${e}`));
    }

  } catch (e) {
    statusItem.text = '$(error) ZeroTrace: Error';
    panel.webview.html = getErrorHtml(panel.webview, context, e.message);
    vscode.window.showErrorMessage(`ZeroTrace scan failed: ${e.message}`);
    console.error('[ZeroTrace]', e);
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
  } finally {
    setTimeout(() => statusItem.dispose(), 10000);
  }
}

<<<<<<< HEAD
// ─── Loading HTML (shown while scan runs) ─────────────────────────────────────
function getLoadingHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a; color: #e2e8f0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      height: 100vh; gap: 24px;
    }
    h1 { font-size: 24px; font-weight: 800; color: #f1f5f9; }
    .spinner {
      width: 56px; height: 56px; border: 4px solid #1e293b;
      border-top-color: #6366f1; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .stage { font-size: 18px; font-weight: 600; color: #6366f1; min-height: 28px; }
    .message { font-size: 13px; color: #64748b; min-height: 20px; max-width: 480px; text-align: center; }
    .log-box {
      background: #1e293b; border-radius: 8px; padding: 12px 16px;
      width: 520px; max-height: 180px; overflow-y: auto;
      font-size: 12px; font-family: monospace; color: #94a3b8;
    }
    .agents {
      display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
    }
    .agent {
      background: #1e293b; border-radius: 8px; padding: 10px 16px;
      font-size: 12px; color: #64748b; border: 1px solid #334155;
      transition: all 0.3s;
    }
    .agent.active { border-color: #6366f1; color: #a5b4fc; }
    .agent.done   { border-color: #22c55e; color: #86efac; }
  </style>
</head>
<body>
  <h1>🔍 Vulentry</h1>
  <p style="color:#64748b;font-size:14px">Multi-Agent AI Security Scanner</p>
  <div class="spinner"></div>
  <div class="stage" id="stage">Initializing...</div>
  <div class="message" id="msg">Starting LangGraph agent pipeline...</div>

  <div class="agents">
    <div class="agent" id="a-scanner">📁 Scanner</div>
    <div class="agent" id="a-pattern">🔎 Pattern</div>
    <div class="agent" id="a-llm">🤖 AI Analyzer</div>
    <div class="agent" id="a-verifier">✅ Verifier</div>
    <div class="agent" id="a-reporter">📄 Reporter</div>
  </div>

  <div class="log-box" id="log">Waiting for agents to start...</div>

  <script>
    const stageMap = {
      'Scanning Files':      'a-scanner',
      'Pattern Analysis':    'a-pattern',
      'AI Analysis':         'a-llm',
      'Verifying Findings':  'a-verifier',
      'Generating Report':   'a-reporter',
    };
    let activeAgent = null;

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        document.getElementById('stage').textContent = msg.stage || '';
        document.getElementById('msg').textContent   = msg.message || '';

        const agentId = stageMap[msg.stage];
        if (agentId && agentId !== activeAgent) {
          if (activeAgent) {
            document.getElementById(activeAgent)?.classList.replace('active', 'done');
          }
          document.getElementById(agentId)?.classList.add('active');
          activeAgent = agentId;
        }

        const log = document.getElementById('log');
        log.innerHTML += '<div>' + (msg.message || '').replace(/</g,'&lt;') + '</div>';
        log.scrollTop = log.scrollHeight;
      }
    });
  </script>
</body>
</html>`;
}

// ─── Error HTML ────────────────────────────────────────────────────────────────
function getErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: sans-serif; background:#0f172a; color:#e2e8f0;
    display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:16px; }
  .err { background:#7f1d1d; color:#fca5a5; border-radius:8px; padding:20px; max-width:600px; font-size:14px; }
</style></head>
<body>
  <h1 style="color:#f87171">❌ Vulentry Error</h1>
  <div class="err"><pre style="white-space:pre-wrap">${message.replace(/</g,'&lt;')}</pre></div>
  <p style="color:#64748b;font-size:13px">Check the Output panel → Vulentry for details.</p>
</body>
</html>`;
=======
// ─── Helpers: find .zerotrace HTML reports on disk ────────────────────────────

/**
 * Return the path to the newest .html file inside `dir`, or null if none found.
 */
function findLatestHtmlInDir(dir) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.html') || f.endsWith('.htm'))
      .map(f => {
        const full = path.join(dir, f);
        return { full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files.length ? files[0].full : null;
  } catch { return null; }
}

/**
 * Walk `root` (up to `depth` levels) and collect every `.zerotrace` output directory.
 */
function findZeroTraceDirs(root, results = [], depth = 3) {
  if (depth < 0) return results;
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(root, entry.name);
      if (entry.name === '.zerotrace') {
        results.push(full);
      } else {
        findZeroTraceDirs(full, results, depth - 1);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

// ─── Loading HTML (shown while scan runs) ─────────────────────────────────────
function getLoadingHtml(webview, context) {
  const nonce   = getNonce();
  const logoUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'media', 'zerotrace.png')
  ).toString();
  const htmlPath = path.join(context.extensionPath, 'media', 'loading.html');
  return fs.readFileSync(htmlPath, 'utf8')
    .replace(/\{\{nonce\}\}/g,     nonce)
    .replace(/\{\{cspSource\}\}/g, webview.cspSource)
    .replace(/\{\{logoUri\}\}/g,   logoUri);
}

// ─── Error HTML ────────────────────────────────────────────────────────────────
function getErrorHtml(webview, context, message) {
  const nonce    = getNonce();
  const htmlPath = path.join(context.extensionPath, 'media', 'error.html');
  return fs.readFileSync(htmlPath, 'utf8')
    .replace(/\{\{nonce\}\}/g,     nonce)
    .replace(/\{\{cspSource\}\}/g, webview.cspSource)
    .replace('{{message}}',        message.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
}

// ─── Activate ──────────────────────────────────────────────────────────────────
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
<<<<<<< HEAD
  console.log('Vulentry: Multi-Agent Security Scanner activated');

  // Command 1: Pick a folder and scan
  const scanCmd = vscode.commands.registerCommand('vulentry.runScan', async () => {
=======
  console.log('ZeroTrace: Multi-Agent Security Scanner activated');

  // Persistent status bar agent (shows dashboard connection / upload state)
  initStatusBar(context);

  // Restore connected state if a token is already stored
  context.secrets.get(SECRETS_TOKEN_KEY).then((t) => {
    if (t) setDashboardStatus('connected');
  });

  // Command 1: Pick a folder and scan
  const scanCmd = vscode.commands.registerCommand('zerotrace.runScan', async () => {
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      openLabel:         'Scan This Folder',
<<<<<<< HEAD
      title:             'Vulentry: Select folder to security scan',
=======
      title:             'ZeroTrace: Select folder to security scan',
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    });

    if (!uris || uris.length === 0) return;
    const targetPath = uris[0].fsPath;
    await runScan(targetPath, context);
  });

  // Command 2: Scan currently open workspace (falls back to folder picker if none open)
<<<<<<< HEAD
  const scanOpenCmd = vscode.commands.registerCommand('vulentry.runScanOnOpen', async () => {
=======
  const scanOpenCmd = vscode.commands.registerCommand('zerotrace.runScanOnOpen', async () => {
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
    const folders = vscode.workspace.workspaceFolders;

    let targetPath;

    if (!folders || folders.length === 0) {
      // No workspace open — fall back to folder picker
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles:   false,
        canSelectFolders: true,
        canSelectMany:    false,
        openLabel:        'Scan This Folder',
<<<<<<< HEAD
        title:            'Vulentry: No workspace open — select a folder to scan',
=======
        title:            'ZeroTrace: No workspace open — select a folder to scan',
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
      });
      if (!uris || uris.length === 0) return;
      targetPath = uris[0].fsPath;
    } else if (folders.length === 1) {
      targetPath = folders[0].uri.fsPath;
    } else {
      const pick = await vscode.window.showQuickPick(
        folders.map((f) => ({ label: f.name, description: f.uri.fsPath, folder: f })),
        { placeHolder: 'Select workspace folder to scan' }
      );
      if (!pick) return;
      targetPath = pick.folder.uri.fsPath;
    }

    await runScan(targetPath, context);
  });

  context.subscriptions.push(scanCmd, scanOpenCmd);
<<<<<<< HEAD
=======

  // Command 3: Connect to dashboard (interactive login)
  const connectCmd = vscode.commands.registerCommand('zerotrace.connectDashboard', async () => {
    await context.secrets.delete(SECRETS_TOKEN_KEY);
    setDashboardStatus('connecting');
    const token = await getDashboardToken(context);
    if (!token) {
      setDashboardStatus('disconnected');
      vscode.window.showErrorMessage('ZeroTrace: Could not connect to dashboard. Check your credentials.');
    }
  });

  // Command 4: Disconnect from dashboard (clear stored token)
  const disconnectCmd = vscode.commands.registerCommand('zerotrace.disconnectDashboard', async () => {
    await context.secrets.delete(SECRETS_TOKEN_KEY);
    setDashboardStatus('disconnected');
    vscode.window.showInformationMessage('ZeroTrace: Disconnected from dashboard.');
  });

  // Command 5: Check server connection + last upload state
  const statusCmd = vscode.commands.registerCommand('zerotrace.checkDashboardStatus', async () => {
    const dashCfg = getDashboardConfig();
    const token   = await context.secrets.get(SECRETS_TOKEN_KEY);
    const barText = _statusBar?.text || '—';

    if (!token) {
      const action = await vscode.window.showInformationMessage(
        `ZeroTrace Dashboard: Not connected.\nServer: ${dashCfg.serverUrl}`,
        'Connect Now'
      );
      if (action === 'Connect Now') {
        vscode.commands.executeCommand('zerotrace.connectDashboard');
      }
      return;
    }

    // Ping the server health endpoint
    try {
      const res = await httpRequest(`${dashCfg.serverUrl}/api/health`, { method: 'GET', headers: {} });
      const ok  = res.status === 200;
      const action = await vscode.window.showInformationMessage(
        `ZeroTrace Dashboard\n` +
        `Server: ${dashCfg.serverUrl} — ${ok ? '✓ reachable' : '✗ unreachable (HTTP ' + res.status + ')'}\n` +
        `Status: ${barText}`,
        ok ? 'Upload HTML Report' : 'Reconnect',
        'Disconnect'
      );
      if (action === 'Upload HTML Report') vscode.commands.executeCommand('zerotrace.uploadHtmlReport');
      if (action === 'Reconnect') vscode.commands.executeCommand('zerotrace.connectDashboard');
      if (action === 'Disconnect') vscode.commands.executeCommand('zerotrace.disconnectDashboard');
    } catch (e) {
      vscode.window.showErrorMessage(`ZeroTrace: Cannot reach dashboard server — ${e.message}`);
      setDashboardStatus('failed', 'server unreachable');
    }
  });

  // Command 6: Auto-discover .zerotrace HTML reports and upload to dashboard
  const uploadCmd = vscode.commands.registerCommand('zerotrace.uploadHtmlReport', async () => {
    // 1. Build candidate search roots from open workspace folders
    const wsFolders = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
    if (wsFolders.length === 0) {
      vscode.window.showWarningMessage('ZeroTrace: Open a workspace folder first.');
      return;
    }

    // 2. Find all .zerotrace output directories
    const ztDirs = [];
    for (const root of wsFolders) {
      findZeroTraceDirs(root, ztDirs, 4);
    }

    if (ztDirs.length === 0) {
      // No auto-discovered dirs — fallback to file picker
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true, canSelectFolders: false, canSelectMany: false,
        openLabel: 'Upload HTML Report',
        filters: { 'HTML Reports': ['html', 'htm'] },
      });
      if (!uris || uris.length === 0) return;
      const htmlReport = fs.readFileSync(uris[0].fsPath, 'utf8');
      await uploadReportToDashboard(context, { htmlReport, targetPath: uris[0].fsPath, summary: {} });
      return;
    }

    // 3. Collect the newest HTML in each .zerotrace dir
    const candidates = [];
    for (const dir of ztDirs) {
      const html = findLatestHtmlInDir(dir);
      if (html) candidates.push(html);
    }

    if (candidates.length === 0) {
      vscode.window.showWarningMessage('ZeroTrace: No HTML report files found in .zerotrace folders.');
      return;
    }

    // 4. If multiple candidates, let the user pick; otherwise proceed directly
    let chosen;
    if (candidates.length === 1) {
      chosen = candidates[0];
    } else {
      const picked = await vscode.window.showQuickPick(
        candidates.map(c => ({ label: path.basename(c), description: c, filePath: c })),
        { placeHolder: 'Select a ZeroTrace HTML report to upload', title: 'ZeroTrace: Upload Report' }
      );
      if (!picked) return;
      chosen = picked.filePath;
    }

    const fileSizeKB = (fs.statSync(chosen).size / 1024).toFixed(1);
    const confirmed = await vscode.window.showInformationMessage(
      `Upload "${path.basename(chosen)}" (${fileSizeKB} KB) to dashboard?`,
      { modal: true }, 'Upload'
    );
    if (confirmed !== 'Upload') return;

    let htmlReport;
    try { htmlReport = fs.readFileSync(chosen, 'utf8'); }
    catch (e) { vscode.window.showErrorMessage(`ZeroTrace: Failed to read file — ${e.message}`); return; }

    console.log(`[ZeroTrace] Upload: ${chosen} (${fileSizeKB} KB)`);
    const saved = await uploadReportToDashboard(context, {
      htmlReport,
      targetPath: chosen,
      summary: { riskLevel: 'UNKNOWN', totalFindings: 0 },
    });
    if (saved) {
      vscode.window.showInformationMessage(`ZeroTrace: "${path.basename(chosen)}" saved to dashboard ✓`);
    }
  });

  context.subscriptions.push(connectCmd, disconnectCmd, statusCmd, uploadCmd);
>>>>>>> cba3e430cf510341d77a07e89dcdee06e8c99cfe
}

function deactivate() {}

module.exports = { activate, deactivate };

