import * as vscode from 'vscode';

export class SettingsPanel {
  private static currentPanel: SettingsPanel | null = null;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionContext: vscode.ExtensionContext;

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.extensionContext = context;
    this.panel.webview.html = SettingsPanel.getHtml(this.panel.webview);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg?.type === 'getSettings') {
          const st = context.globalState.get('auditor.settings') || { mode: 'mock', baseUrl: '', apiKey: '', flags: {} };
          this.panel.webview.postMessage({ type: 'settings', payload: st });
        }

        if (msg?.type === 'saveSettings') {
          await context.globalState.update('auditor.settings', msg.payload || {});
          this.panel.webview.postMessage({ type: 'saved' });
        }

        if (msg?.type === 'checkHealth') {
          const base = (msg.payload || '').replace(/\/$/, '');
          if (!base) { this.panel.webview.postMessage({ type: 'health', payload: { ok: false, status: 'No base URL' } }); return; }
          try {
            // helper server exposes /health
            const resp = await fetch(base + '/health', { method: 'GET' as const });
            if (resp.ok) {
              const j: any = await resp.json().catch(() => null);
              this.panel.webview.postMessage({ type: 'health', payload: { ok: true, status: j?.status ?? 'ok' } });
            } else {
              this.panel.webview.postMessage({ type: 'health', payload: { ok: false, status: `HTTP ${resp.status}` } });
            }
          } catch (e: any) {
            this.panel.webview.postMessage({ type: 'health', payload: { ok: false, status: String(e?.message || e) } });
          }
        }

        if (msg?.type === 'reanalyze') {
          // trigger existing grab command which will run analysis
          await vscode.commands.executeCommand('aiAuditor.grabNow');
        }
      } catch (e) {
        // ignore errors
      }
    });
  }

  public static show(context: vscode.ExtensionContext) {
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel('auditorSettings', 'AI Auditor — Settings', { viewColumn: vscode.ViewColumn.Active, preserveFocus: false }, { enableScripts: true });
    SettingsPanel.currentPanel = new SettingsPanel(panel, context);

    panel.onDidDispose(() => { SettingsPanel.currentPanel = null; }, null, context.subscriptions);
  }

  private static getHtml(webview: vscode.Webview): string {
    // Minimal popup-like UI adapted from browser popup
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'unsafe-inline' 'unsafe-eval' ; style-src 'unsafe-inline';">
    <title>AI Auditor — Settings</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 12px; min-width: 320px; }
      h3 { margin: 0 0 8px; font-size: 14px; }
      label { display:block; margin:6px 0; font-size:13px }
      input[type="text"], input[type="password"], select { width:100%; padding:6px; border:1px solid #ddd; border-radius:6px; font-size:12px }
      button { margin-top:8px; padding:6px 10px }
      .row { display:flex; gap:8px; align-items:center }
      #input-preview { white-space:pre-wrap; border:1px solid #eee; border-radius:6px; padding:8px; font-size:12px; color:#333; max-height:140px; overflow:auto }
    </style>
  </head>
  <body>
    <h3>Last analysis</h3>
    <div id="summary">No data yet.</div>
    <ul id="list"></ul>
    <button id="reanalyze">Re-run</button>

    <h3 style="margin-top:12px;font-size:13px">Input preview</h3>
    <div id="input-preview">(preview)</div>

    <h3 style="margin-top:12px;font-size:13px">Backend</h3>
    <div style="font-size:12px;margin-bottom:6px">Mode</div>
    <select id="mode">
      <option value="mock">Offline (local)</option>
      <option value="remote">Remote (backend)</option>
    </select>
    <div style="font-size:12px;margin-bottom:6px;margin-top:8px">API base URL</div>
    <input id="apiBase" type="text" placeholder="http://localhost:8000" />
    <div style="font-size:12px;margin:6px 0 6px">API key (optional)</div>
    <input id="apiKey" type="password" placeholder="Bearer token" />
    <div class="row">
      <button id="saveConfig">Save</button>
      <button id="checkHealth">Check health</button>
      <div id="healthStatus" style="align-self:center;font-size:12px;color:#555"></div>
    </div>

    <h3 style="margin-top:12px;font-size:13px">Behavior</h3>
    <label><input id="piiGuard" type="checkbox" /> PII guard (masking)</label>
    <label><input id="blockHigh" type="checkbox" /> Block sending on High risk</label>
    <label><input id="inlineHints" type="checkbox" /> Enable inline hints</label>

    <h3 style="margin-top:12px;font-size:13px">Sites</h3>
    <div id="siteList">
      <label><input type="checkbox" value="chatgpt" /> ChatGPT</label>
      <label><input type="checkbox" value="claude" /> Claude</label>
      <label><input type="checkbox" value="grok" /> Grok</label>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      window.addEventListener('message', (ev) => {
        const m = ev.data;
        if (m?.type === 'settings') {
          const s = m.payload || {};
          document.getElementById('mode').value = s.mode || 'mock';
          document.getElementById('apiBase').value = s.baseUrl || '';
          document.getElementById('apiKey').value = s.apiKey || '';
          document.getElementById('healthStatus').textContent = '';
        }
        if (m?.type === 'saved') {
          document.getElementById('healthStatus').textContent = 'Saved.';
        }
        if (m?.type === 'health') {
          document.getElementById('healthStatus').textContent = m.payload?.status || '';
        }
      });

      document.getElementById('saveConfig').addEventListener('click', () => {
        const payload = { mode: document.getElementById('mode').value, baseUrl: document.getElementById('apiBase').value.trim(), apiKey: document.getElementById('apiKey').value.trim() };
        vscode.postMessage({ type: 'saveSettings', payload });
      });

      document.getElementById('checkHealth').addEventListener('click', () => {
        const base = document.getElementById('apiBase').value.trim();
        document.getElementById('healthStatus').textContent = 'Checking...';
        vscode.postMessage({ type: 'checkHealth', payload: base });
      });

      document.getElementById('reanalyze').addEventListener('click', () => {
        vscode.postMessage({ type: 'reanalyze' });
      });

      // request initial settings
      vscode.postMessage({ type: 'getSettings' });
    </script>
  </body>
</html>`;
  }
}


