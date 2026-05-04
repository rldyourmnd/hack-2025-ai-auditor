import { Finding } from '../types';

export const id = 'db_pool_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const pools = Array.from(content.matchAll(/pool_size\s*[=:]\s*(\d+)/g)).map(m => Number(m[1]));
  const uniq = Array.from(new Set(pools.filter(n => !isNaN(n))));
  if (uniq.length > 1) findings.push({ kind: 'db_pool_divergence', scope: 'package', file: relpath, message: `Multiple DB pool sizes detected: ${uniq.join(',')}`, meta: { detector: 'regex', pools: uniq } });
  return findings;
}


