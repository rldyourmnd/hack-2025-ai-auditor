import { Finding } from '../types';
import * as vscode from 'vscode';
import * as path from 'path';

export const id = 'repo_import_graph';
export const extensions = ['.py'];

// Repository-wide import graph: scan all .py files and emit one finding with aggregated edges + simple problems
export function run(_: string, relpath: string): Finding[] {
  // Run only once on the first encountered file in the workspace root package
  if (relpath.includes('/site-packages/')) return [];
  const findings: Finding[] = [];
  const ws = vscode.workspace.workspaceFolders ?? [];
  if (ws.length === 0) return findings;

  const edges: Array<{ from: string; to: string }> = [];
  const nodes = new Set<string>();

  // collect edges by reusing quick regex over all .py files
  return (function collect() {
    return vscode.workspace.findFiles('**/*.py', undefined, 200000).then(async (uris) => {
      for (const u of uris) {
        const rel = vscode.workspace.asRelativePath(u);
        try {
          const raw = await vscode.workspace.fs.readFile(u);
          const text = Buffer.from(raw).toString('utf8');
          const stripped = text.replace(/([rRuU]?[fF]?"""[\s\S]*?""")/g, ' ').replace(/([rRuU]?[fF]?'''[\s\S]*?''')/g, ' ').replace(/#.*$/gm, ' ');
          const fromRe = /^\s*from\s+([\w\.]+)\s+import\s+([\w\*,\s]+)/gm;
          const importRe = /^\s*import\s+([\w\.]+)/gm;
          let m: RegExpExecArray | null;
          while ((m = fromRe.exec(stripped))) {
            const mod = (m[1] || '').trim();
            const names = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
            for (const n of names) {
              const to = mod ? `${mod}.${n}` : n;
              edges.push({ from: rel, to });
              nodes.add(rel); nodes.add(to);
            }
          }
          while ((m = importRe.exec(stripped))) {
            const mod = (m[1] || '').trim();
            if (mod) { edges.push({ from: rel, to: mod }); nodes.add(rel); nodes.add(mod); }
          }
        } catch {}
      }

      // detect small cycles (2,3)
      const toIdx = new Map<string, number>();
      const idxToNode: string[] = [];
      for (const n of nodes) { toIdx.set(n, idxToNode.length); idxToNode.push(n); }
      const adj: number[][] = Array.from({ length: idxToNode.length }, () => []);
      for (const e of edges) {
        const a = toIdx.get(e.from); const b = toIdx.get(e.to);
        if (a !== undefined && b !== undefined) adj[a].push(b);
      }
      const problems: Array<{ type: string; details: any }> = [];
      // 2-cycles
      for (let a = 0; a < adj.length; a++) {
        for (const b of adj[a]) {
          if (adj[b]?.includes(a)) problems.push({ type: 'cycle2', details: { a: idxToNode[a], b: idxToNode[b] } });
        }
      }
      // 3-cycles
      for (let a = 0; a < adj.length; a++) {
        for (const b of adj[a]) for (const c of adj[b] || []) {
          if ((adj[c] || []).includes(a)) problems.push({ type: 'cycle3', details: { a: idxToNode[a], b: idxToNode[b], c: idxToNode[c] } });
        }
      }

      // dangling modules: nodes with no inbound/outbound
      const inbound = new Array(adj.length).fill(0); const outbound = adj.map(l => l.length);
      for (let a = 0; a < adj.length; a++) for (const b of adj[a]) inbound[b]++;
      for (let i = 0; i < adj.length; i++) if (inbound[i] === 0 || outbound[i] === 0) problems.push({ type: 'dangling', details: { node: idxToNode[i], inbound: inbound[i], outbound: outbound[i] } });

      findings.push({ kind: 'repo_import_graph', scope: 'project', file: '', message: `Graph: nodes=${nodes.size}, edges=${edges.length}, problems=${problems.length}`, meta: { detector: 'regex', nodes: nodes.size, edges: edges.length, problems } });
      return findings;
    }) as unknown as Finding[];
  })();
}


