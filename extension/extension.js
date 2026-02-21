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
  const cfg = vscode.workspace.getConfiguration('zerotrace');
  return {
    apiKey:        cfg.get('mistralApiKey') || process.env.MISTRAL_API_KEY || '',
    model:         cfg.get('mistralModel')  || 'mistral-large-latest',
    maxFileSizeKB: cfg.get('maxFileSizeKB') || 200,
    extensions:    cfg.get('fileExtensions'),
  };
}

// ─── Nonce helper (for CSP) ───────────────────────────────────────────────────
function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Create / reveal a loading webview panel ──────────────────────────────────
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
  return panel;
}

// ─── Update webview with progress ─────────────────────────────────────────────
function updatePanelProgress(panel, stage, message) {
  panel.webview.postMessage({ type: 'progress', stage, message });
}

// ─── Set final report HTML ─────────────────────────────────────────────────────
function setPanelReport(panel, html, title) {
  panel.title = title || 'ZeroTrace — Security Report';
  panel.webview.html = html;
}

// ─── Core scan runner ──────────────────────────────────────────────────────────
async function runScan(targetPath, context) {
  const config = getConfig();

  // Validate API key
  if (!config.apiKey) {
    const action = await vscode.window.showErrorMessage(
      'ZeroTrace: Mistral API key not configured.',
      'Open Settings'
    );
    if (action === 'Open Settings') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'zerotrace.mistralApiKey');
    }
    return;
  }

  // Create output directory inside the scanned project
  const outputDir = path.join(targetPath, '.zerotrace');
  try { fs.mkdirSync(outputDir, { recursive: true }); } catch {}

  // Create webview panel
  const panel = createLoadingPanel(context);

  // Status bar progress
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.text = '$(sync~spin) ZeroTrace: Scanning...';
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
        console.log(`[ZeroTrace] [${stage}] ${message || ''}${pct}`);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    statusItem.text = `$(shield) ZeroTrace: Done in ${elapsed}s`;

    if (result.htmlReport) {
      const logoUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'media', 'zerotrace.png')
      ).toString();
      const htmlWithLogo = result.htmlReport.replace(/\{\{LOGO_SRC\}\}/g, logoUri);
      const summary = result.reportJson?.summary;
      const title   = `ZeroTrace — ${summary?.riskLevel || 'UNKNOWN'} Risk | ${summary?.totalFindings || 0} findings`;
      setPanelReport(panel, htmlWithLogo, title);

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
      panel.webview.html = getErrorHtml(panel.webview, context, 'Report generation failed. Check the ZeroTrace output console.');
    }

    // Log errors if any
    if (result.errors?.length > 0) {
      result.errors.forEach((e) => console.error(`[ZeroTrace] Error: ${e}`));
    }

  } catch (e) {
    statusItem.text = '$(error) ZeroTrace: Error';
    panel.webview.html = getErrorHtml(panel.webview, context, e.message);
    vscode.window.showErrorMessage(`ZeroTrace scan failed: ${e.message}`);
    console.error('[ZeroTrace]', e);
  } finally {
    setTimeout(() => statusItem.dispose(), 10000);
  }
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
}

// ─── Activate ──────────────────────────────────────────────────────────────────
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('ZeroTrace: Multi-Agent Security Scanner activated');

  // Command 1: Pick a folder and scan
  const scanCmd = vscode.commands.registerCommand('zerotrace.runScan', async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      openLabel:         'Scan This Folder',
      title:             'ZeroTrace: Select folder to security scan',
    });

    if (!uris || uris.length === 0) return;
    const targetPath = uris[0].fsPath;
    await runScan(targetPath, context);
  });

  // Command 2: Scan currently open workspace (falls back to folder picker if none open)
  const scanOpenCmd = vscode.commands.registerCommand('zerotrace.runScanOnOpen', async () => {
    const folders = vscode.workspace.workspaceFolders;

    let targetPath;

    if (!folders || folders.length === 0) {
      // No workspace open — fall back to folder picker
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles:   false,
        canSelectFolders: true,
        canSelectMany:    false,
        openLabel:        'Scan This Folder',
        title:            'ZeroTrace: No workspace open — select a folder to scan',
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

