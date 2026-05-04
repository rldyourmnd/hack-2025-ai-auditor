import { Finding } from '../types';

export const id = 'retry_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const retries = Array.from(content.matchAll(/retry.*?\(?\s*(\d+)\s*\)?/g)).map(m => Number(m[1]));
  const uniq = Array.from(new Set(retries.filter(n => !isNaN(n))));
  if (uniq.length > 1) findings.push({ kind: 'retry_divergence', scope: 'package', file: relpath, message: `Multiple retry values detected: ${uniq.join(',')}`, meta: { detector: 'regex', retries: uniq } });
  return findings;
}


