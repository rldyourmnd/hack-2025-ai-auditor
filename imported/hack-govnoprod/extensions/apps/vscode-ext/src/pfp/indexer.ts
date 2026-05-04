import * as vscode from 'vscode';
import fg from 'fast-glob';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

export async function scanWorkspace(include: string[] = ['**/*.py'], exclude: string[] = ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'], options?: { excludeVirtualEnv?: boolean; excludeSitePackages?: boolean; }): Promise<Array<{ path: string; sha: string; size: number }>> {
  const roots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
  const results: Array<{ path: string; sha: string; size: number }> = [];
  for (const r of roots) {
    // prepare ignore list
    const ignoreList = Array.from(exclude);
    if (options?.excludeVirtualEnv !== false) {
      ignoreList.push('**/.venv/**', '**/venv/**', '**/.virtualenv/**');
    }
    // optionally try to exclude site-packages by heuristic
    if (options?.excludeSitePackages !== false) {
      ignoreList.push('**/site-packages/**', '**/dist-packages/**');
    }
    // run fast-glob with cwd to keep results relative and cross-platform
    const entries = await fg(include, { cwd: r, ignore: ignoreList, onlyFiles: true, dot: true, followSymbolicLinks: false, unique: true });
    for (const rel of entries) {
      const e = path.join(r, rel);
      try {
        const buf = await fs.promises.readFile(e);
        const h = crypto.createHash('sha256').update(buf).digest('hex');
        results.push({ path: rel.replace(/\\/g, '/'), sha: `sha256:${h}`, size: buf.length });
      } catch (err) { continue; }
    }
  }
  return results;
}

export default {};


