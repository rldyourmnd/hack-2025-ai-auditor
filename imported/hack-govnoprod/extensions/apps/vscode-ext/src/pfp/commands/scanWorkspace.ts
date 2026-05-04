import * as vscode from 'vscode';
import * as path from 'path';
import { scanWorkspace } from '../indexer';
import { appendProfile, ensureStore } from '../profilesStore';
import { detectPathRole } from '../detectors/roleDetectors';

export async function scanWorkspaceCommand(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration();
  const include = cfg.get<string[]>('aiAuditorPfp.include', ['**/*.py']) || ['**/*.py'];
  const exclude = cfg.get<string[]>('aiAuditorPfp.exclude', ['**/node_modules/**','**/.git/**']) || [];
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) { vscode.window.showInformationMessage('Open a workspace folder first.'); return; }
  const files = await scanWorkspace(include, exclude);
  const { file } = await ensureStore(wsRoot);
  vscode.window.showInformationMessage(`PFP: Found ${files.length} files; writing minimal profiles to ${file}`);
  for (const f of files) {
    const role = await detectPathRole(path.join(wsRoot, f.path));
    // ensure pfp is valid (scanWorkspace writes minimal compact profiles with null pfp so OK)
    await appendProfile(wsRoot, { path: f.path, sha: f.sha, size: f.size, ts: new Date().toISOString(), tier: 'compact', pfp: null, decode_hint: { schema: 'v2.3', flags: 0, planes_present: ['C0'] }, role });
  }
  vscode.window.showInformationMessage('PFP: scanWorkspace completed (compact profiles written).');
}

export default scanWorkspaceCommand;


