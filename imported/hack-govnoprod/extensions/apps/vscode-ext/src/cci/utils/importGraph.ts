import * as vscode from 'vscode';

// Build a lightweight import graph for python files in the workspace
export async function buildImportGraph(glob = '**/*.py') {
  const uris = await vscode.workspace.findFiles(glob, undefined, 200000);
  const edges: Array<{ from: string; to: string }> = [];
  const nodes = new Set<string>();
  for (const u of uris) {
    try {
      const rel = vscode.workspace.asRelativePath(u);
      const raw = await vscode.workspace.fs.readFile(u);
      const text = Buffer.from(raw).toString('utf8');
      // Strip docstrings (both triple double and triple single quotes). Previous regex for ''' had an extra quote.
      const stripped = text
        .replace(/([rRuU]?[fF]?"""[\s\S]*?""")/g, ' ')
        .replace(/([rRuU]?[fF]?'''[\s\S]*?''')/g, ' ')
        .replace(/#.*$/gm, ' ');
      const fromRe = /^\s*from\s+([\w\.]+)\s+import\s+([\w\*,\s]+)/gm;
      const importRe = /^\s*import\s+([\w\.]+)/gm;
      let m: RegExpExecArray | null;
      while ((m = fromRe.exec(stripped))) {
        const mod = (m[1] || '').trim();
        const names = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
        for (const n of names) {
          const to = mod ? `${mod}.${n}` : n;
          edges.push({ from: rel, to }); nodes.add(rel); nodes.add(to);
        }
      }
      while ((m = importRe.exec(stripped))) {
        const mod = (m[1] || '').trim();
        if (mod) { edges.push({ from: rel, to: mod }); nodes.add(rel); nodes.add(mod); }
      }
    } catch {}
  }
  return { nodes: Array.from(nodes), edges };
}


