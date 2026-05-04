import { Finding } from '../types';
import * as vscode from 'vscode';

export const id = 'env_missing_decl';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const envUses = Array.from(content.matchAll(/os\.getenv\(['\"]([A-Z0-9_]+)['\"]\)/g)).map(m => m[1]);
  if (!envUses.length) return findings;
  // try to read workspace .env.example
  try {
    const ws = vscode.workspace.workspaceFolders ?? [];
    if (ws.length === 0) return findings;
    const uri = vscode.Uri.joinPath(ws[0].uri, '.env.example');
    // read file if present (wrap Thenable in Promise.resolve so we can use .catch)
    const raw = Promise.resolve(vscode.workspace.fs.readFile(uri)).catch(() => null) as Promise<Uint8Array|null>;
    // synchronous return pattern: we'll return empty and rely on collector caching; but attempt best-effort async check
    raw.then((buf) => {
      const declared = new Set<string>();
      if (buf) {
        const txt = Buffer.from(buf).toString('utf8');
        for (const l of txt.split(/\r?\n/)) {
          const p = l.split('=')[0];
          if (p) declared.add(p.trim());
        }
      }
      for (const v of envUses) if (!declared.has(v)) findings.push({ kind: 'env_missing_decl', scope: 'file', file: relpath, message: `Env ${v} used but not declared in .env.example`, meta: { detector: 'regex' } });
    }).catch(() => {});
  } catch (e) {
    // ignore
  }
  return findings;
}


