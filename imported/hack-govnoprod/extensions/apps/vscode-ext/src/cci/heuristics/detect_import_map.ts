import { Finding } from '../types';

export const id = 'import_map';
export const extensions = ['.py'];

// Per-file import map: collect imports with alias/module normalization
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const edges: Array<{ from: string; to: string; alias?: string; kind: 'from'|'import' } > = [];

  // strip strings/comments to avoid false positives
  const stripped = content
    .replace(/([rRuU]?[fF]?"""[\s\S]*?""")/g, ' ')
    .replace(/([rRuU]?[fF]?'''[\s\S]*?''')/g, ' ')
    .replace(/#.*$/gm, ' ');

  const fromRe = /^\s*from\s+([\w\.]+)\s+import\s+([\w\*,\s]+)(?:\s+as\s+(\w+))?/gm;
  const importRe = /^\s*import\s+([\w\.]+)(?:\s+as\s+(\w+))?/gm;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(stripped))) {
    const mod = (m[1] || '').trim();
    const names = (m[2] || '').split(',').map(s => s.trim()).filter(Boolean);
    for (const n of names) {
      edges.push({ from: relpath, to: mod ? `${mod}.${n}` : n, kind: 'from' });
    }
  }
  while ((m = importRe.exec(stripped))) {
    const mod = (m[1] || '').trim();
    const alias = (m[2] || '').trim() || undefined;
    if (mod) edges.push({ from: relpath, to: mod, alias, kind: 'import' });
  }

  if (edges.length) findings.push({ kind: 'import_map', scope: 'file', file: relpath, message: `Imports: ${edges.length}`, meta: { detector: 'regex', edges } });
  return findings;
}


