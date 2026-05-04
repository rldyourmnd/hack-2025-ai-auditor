import * as vscode from 'vscode';
import { fullInstallFlow, resolveAhkAssets } from '../install/installer';

export class InstallPanel {
  private panel: vscode.WebviewPanel | null = null;

  constructor(private readonly context: vscode.ExtensionContext, private readonly out: vscode.OutputChannel) {}

  show() {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'ahkInstall',
        'AutoHotkey — Setup',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => { this.panel = null; });
      this.panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg?.type === 'install') {
          try {
            const result = await fullInstallFlow(this.context, this.out);
            if (result) {
              vscode.window.showInformationMessage(`AHK ready: ${result.ahkPath}`);
            } else {
              vscode.window.showWarningMessage('AHK installation failed. Try manual steps.');
            }
          } catch (e: any) {
            vscode.window.showErrorMessage(`Install error: ${String(e?.message||e)}`);
          }
        } else if (msg?.type === 'openScripts') {
          const p = this.context.globalStoragePath + '/scripts';
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(p));
        } else if (msg?.type === 'openLogs') {
          const p = this.context.globalStoragePath + '/logs';
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(p));
        }
      });
    }
    this.panel.webview.html = this.renderHtml();
  }

  private renderHtml(): string {
    const assets = resolveAhkAssets(this.context);
    const installerHint = assets.installerDir.replace(/\\/g, '/');
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body{font-family:var(--vscode-font-family);padding:12px;}
        .row{margin: 8px 0;}
        code{background:#0001;padding:2px 4px;border-radius:4px;}
      </style>
    </head>
    <body>
      <h3>AutoHotkey Setup</h3>
      <div class="row">Bundled installer dir: <code>${installerHint}</code></div>
      <div class="row">
        <button id="install">Установить автоматически</button>
        <button id="open-scripts">Открыть папку скриптов</button>
        <button id="open-logs">Открыть папку логов</button>
      </div>
      <h4>Ручная установка</h4>
      <ol>
        <li>Скачайте AHK v2 с <a href="https://www.autohotkey.com/" target="_blank">официального сайта</a>.</li>
        <li>Если SmartScreen блокирует: «Дополнительные сведения» → «Выполнить в любом случае».</li>
        <li>После установки вернитесь и нажмите «Установить автоматически» ещё раз.</li>
      </ol>
      <script>
        const vscode = acquireVsCodeApi();
        window.addEventListener('DOMContentLoaded', () => {
          const installBtn = document.getElementById('install');
          if (installBtn) installBtn.addEventListener('click', () => { vscode.postMessage({ type: 'install' }); });
          const openScriptsBtn = document.getElementById('open-scripts');
          if (openScriptsBtn) openScriptsBtn.addEventListener('click', () => { vscode.postMessage({ type: 'openScripts' }); });
          const openLogsBtn = document.getElementById('open-logs');
          if (openLogsBtn) openLogsBtn.addEventListener('click', () => { vscode.postMessage({ type: 'openLogs' }); });
        });
      </script>
    </body>
    </html>`;
  }
}


