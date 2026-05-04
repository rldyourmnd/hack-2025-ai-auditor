import { Finding } from '../types';
import * as vscode from 'vscode';

export const id = 'cyclomatic_complexity';
export const extensions = ['.py'];

// McCabe-like cyclomatic complexity per function: CC = 1 + sum(decision points)
// decision tokens considered: if, elif, for, while, try, except, with, and, or, case, except*, comprehension for, boolean ops
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const cfg = vscode.workspace.getConfiguration('cci') || {};
  const threshold = Number(cfg.get<number>('thresholds.cyclomatic') ?? 10);

  // strip triple-quoted and normal strings to avoid counting keywords inside strings
  const stripped = content
    .replace(/([rRuU]?[fF]?"""[\s\S]*?""")/g, ' ') // """..."""
    .replace(/([rRuU]?[fF]?'''[\s\S]*?''')/g, ' ') // '''...'''
    .replace(/([rRuU]?[fF]?"(?:\\.|[^"])*")/g, ' ') // "..."
    .replace(/([rRuU]?[fF]?'(?:\\.|[^'])*')/g, ' '); // '...'

  const lines = stripped.split(/\r?\n/);

  type Func = { name: string; indent: number; start: number; end: number };
  const funcs: Func[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const defMatch = line.match(/^([ \t]*)def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*:/);
    if (defMatch) {
      const indent = defMatch[1].length;
      const name = defMatch[2];
      // find block end by lower indentation non-empty line
      let j = i + 1;
      for (; j < lines.length; j++) {
        const l = lines[j];
        if (!l.trim()) continue;
        const curIndent = (l.match(/^[ \t]*/)?.[0].length || 0);
        if (curIndent <= indent) break;
      }
      funcs.push({ name, indent, start: i, end: j - 1 });
      i = j - 1;
    }
  }

  for (const f of funcs) {
    const body = lines.slice(f.start, f.end + 1).join('\n');
    // remove comments
    const noComments = body.replace(/#.*/g, '');
    let cc = 1;
    const add = (re: RegExp) => { cc += (noComments.match(re) || []).length; };
    add(/\bif\b/g);
    add(/\belif\b/g);
    add(/\bfor\b/g);
    add(/\bwhile\b/g);
    add(/\btry\b/g);
    add(/\bexcept\b/g);
    add(/\bwith\b/g);
    add(/\bcase\b/g); // match/case
    add(/\band\b/g);
    add(/\bor\b/g);
    // comprehensions: [.. for ..], {.. for ..}, (.. for ..)
    add(/\[[^\]]*\bfor\b[^\]]*\]/g);
    add(/\{[^}]*\bfor\b[^}]*\}/g);
    add(/\([^\)]*\bfor\b[^\)]*\)/g);

    if (cc > threshold) {
      findings.push({ kind: 'cyclomatic_complexity', scope: 'file', file: relpath, message: `High cyclomatic complexity in ${f.name}: ${cc} (>${threshold})`, meta: { detector: 'mccabe', function: f.name, cc } });
    }
  }

  return findings;
}


