import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function getAuditDirForWorkspace(workspaceRoot?: string) {
  try {
    const cfg = vscode.workspace.getConfiguration();
    const rel = (cfg.get<string>('audit.directory', '.audit') || '.audit').trim();
    const root = workspaceRoot || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || process.cwd();
    const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
    try { fs.mkdirSync(abs, { recursive: true }); } catch {}
    return abs;
  } catch (e) { return path.join(process.cwd(), '.audit'); }
}

export async function pickWorkspaceRoot(): Promise<vscode.Uri | null> {
  const folders = vscode.workspace.workspaceFolders || [];
  if (folders.length === 0) {
    vscode.window.showInformationMessage('No workspace folder open.');
    return null;
  }
  if (folders.length === 1) return folders[0].uri;
  const pick = await vscode.window.showQuickPick(
    folders.map((f) => ({ label: f.name, description: f.uri.fsPath, uri: f.uri })),
    { placeHolder: 'Select workspace root to pack' }
  );
  return pick ? (pick as any).uri as vscode.Uri : null;
}

export function withStatus<T>(label: string, run: (token: vscode.CancellationToken, status: vscode.StatusBarItem) => Promise<T>): Promise<T> {
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  bar.text = label;
  bar.show();
  const cts = new vscode.CancellationTokenSource();
  const promise: Promise<any> = new Promise((resolve, reject) => {
    const progressThenable = vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: label, cancellable: true }, async (progress, uiToken) => {
      uiToken.onCancellationRequested(() => cts.cancel());
      try {
        const r = await run(cts.token, bar);
        resolve(r);
      } catch (err) {
        reject(err);
      }
    });
    (progressThenable as Thenable<any>).then(
      () => { try { bar.hide(); bar.dispose(); } catch {} },
      (err: any) => { try { bar.hide(); bar.dispose(); } catch {} }
    );
  });
  return promise;
}


