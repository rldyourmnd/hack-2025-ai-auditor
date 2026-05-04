import { Finding } from '../types';

export const id = 'env_prefix_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const matches = Array.from(content.matchAll(/os\.getenv\(['\"]([A-Z0-9_]+)['\"]\)/g)).map(m => m[1]);
  const prefixes = new Set<string>();
  for (const m of matches) {
    const p = m.split('_')[0];
    if (p) prefixes.add(p);
  }
  if (prefixes.size > 1) {
    findings.push({ kind: 'env_prefix_divergence', scope: 'project', file: relpath, message: 'Multiple env prefixes detected', meta: { detector: 'regex', prefixes: Array.from(prefixes) } });
  }
  return findings;
}


