import { Finding } from '../types';

export const id = 'timeout_divergence';

// Heuristic: find numeric timeout literals in HTTP/DB client calls and flag if multiple distinct values
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const timeouts = Array.from(content.matchAll(/timeout\s*=\s*(\d+)/g)).map(m => Number(m[1]));
  const uniq = Array.from(new Set(timeouts));
  if (uniq.length > 1) findings.push({ kind: 'timeout_divergence', scope: 'package', file: relpath, message: `Multiple timeout values detected: ${uniq.join(',')}`, meta: { detector: 'regex', timeouts: uniq } });
  return findings;
}


