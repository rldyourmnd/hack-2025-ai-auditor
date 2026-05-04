import { Finding } from '../types';

export const id = 'mapping_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // naive: detect multiple map literals with different keys
  const maps = Array.from(content.matchAll(/\{([^}]+)\}/g)).map(m => m[1].split(',').map(s => s.split(':')[0].trim()).filter(Boolean));
  if (maps.length > 1) {
    const keysets = maps.map(k => k.join(',')).slice(0,5);
    if (new Set(keysets).size > 1) findings.push({ kind: 'mapping_divergence', scope: 'package', file: relpath, message: 'Different mapping shapes detected', meta: { detector: 'regex', samples: keysets } });
  }
  return findings;
}


