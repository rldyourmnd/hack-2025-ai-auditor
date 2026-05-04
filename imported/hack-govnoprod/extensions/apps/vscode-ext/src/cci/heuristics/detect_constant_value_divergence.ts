import { Finding } from '../types';

export const id = 'constant_value_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // find top-level assignments of obvious constants
  const assigns = Array.from(content.matchAll(/^([A-Z0-9_]{3,})\s*=\s*(.+)$/gm)).map(m => ({ name: m[1], value: m[2].trim() }));
  if (assigns.length > 20) {
    // arbitrary heuristic: many top-level constants may indicate divergence
    findings.push({ kind: 'constant_value_divergence', scope: 'package', file: relpath, message: `Many top-level constants detected (${assigns.length})`, meta: { detector: 'regex', sample: assigns.slice(0,5) } });
  }
  return findings;
}


