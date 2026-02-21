'use strict';

const vscode = require('vscode');
const path   = require('path');
const fs     = require('fs');

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
  const cfg = vscode.workspace.getConfiguration('vulentry');
  return {
    apiKey:        cfg.get('mistralApiKey') || process.env.MISTRAL_API_KEY || '',
    model:         cfg.get('mistralModel')  || 'mistral-large-latest',
    maxFileSizeKB: cfg.get('maxFileSizeKB') || 200,
    extensions:    cfg.get('fileExtensions'),
  };
}

// ─── Create / reveal a loading webview panel ──────────────────────────────────
function createLoadingPanel(context) {
  const panel = vscode.window.createWebviewPanel(
    'vulentryReport',
    '🔍 Vulentry — Scanning...',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = getLoadingHtml();
  return panel;
}

// ─── Update webview with progress ─────────────────────────────────────────────
function updatePanelProgress(panel, stage, message) {
  panel.webview.postMessage({ type: 'progress', stage, message });
}

// ─── Set final report HTML ─────────────────────────────────────────────────────
function setPanelReport(panel, html, title) {
  panel.title = title || '🔍 Vulentry — Security Report';
  panel.webview.html = html;
}

// ─── Core scan runner ──────────────────────────────────────────────────────────
async function runScan(targetPath, context) {
  const config = getConfig();

  // Validate API key
  if (!config.apiKey) {
    const action = await vscode.window.showErrorMessage(
      'Vulentry: Mistral API key not configured.',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'vulentry.mistralApiKey');
    }
    return;
  }

  // Create output directory inside the scanned project
  const outputDir = path.join(targetPath, '.vulentry');
  try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}

  // Create webview panel
  const panel = createLoadingPanel(context);

  // Status bar progress
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = '$(sync~spin) Vulentry: Scanning...';
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
        console.log(`[Vulentry] [${stage}] ${message || ''}${pct}`);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    statusItem.text = `$(shield) Vulentry: Done in ${elapsed}s`;

    if (result.htmlReport) {
      const summary = result.reportJson?.summary;
      const title   = `🔍 Vulentry — ${summary?.riskLevel || 'UNKNOWN'} Risk | ${summary?.totalFindings || 0} findings`;
      setPanelReport(panel, result.htmlReport, title);

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
      panel.webview.html = getErrorHtml('Report generation failed. Check the Vulentry output console.');
    }

    // Log errors if any
    if (result.errors?.length > 0) {
      result.errors.forEach((e) => console.error(`[Vulentry] Error: ${e}`));
    }

  } catch (e) {
    statusItem.text = '$(error) Vulentry: Error';
    panel.webview.html = getErrorHtml(e.message);
    vscode.window.showErrorMessage(`Vulentry scan failed: ${e.message}`);
    console.error('[Vulentry]', e);
  } finally {
    setTimeout(() => statusItem.dispose(), 10000);
  }
}

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
}

// ─── Activate ──────────────────────────────────────────────────────────────────
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Vulentry: Multi-Agent Security Scanner activated');

  // Command 1: Pick a folder and scan
  const scanCmd = vscode.commands.registerCommand('vulentry.runScan', async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      openLabel:         'Scan This Folder',
      title:             'Vulentry: Select folder to security scan',
    });

    if (!uris || uris.length === 0) return;
    const targetPath = uris[0].fsPath;
    await runScan(targetPath, context);
  });

  // Command 2: Scan currently open workspace (falls back to folder picker if none open)
  const scanOpenCmd = vscode.commands.registerCommand('vulentry.runScanOnOpen', async () => {
    const folders = vscode.workspace.workspaceFolders;

    let targetPath;

    if (!folders || folders.length === 0) {
      // No workspace open — fall back to folder picker
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles:   false,
        canSelectFolders: true,
        canSelectMany:    false,
        openLabel:        'Scan This Folder',
        title:            'Vulentry: No workspace open — select a folder to scan',
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
}

function deactivate() {}

module.exports = { activate, deactivate };

