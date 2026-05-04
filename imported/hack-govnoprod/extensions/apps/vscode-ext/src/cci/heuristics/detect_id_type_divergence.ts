import { Finding } from '../types';

export const id = 'id_type_divergence';

// Heuristic: detect presence of UUID-like types and int id usage in same file
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const hasUuid = /\buuid\.UUID\b|\bUUID\b/.test(content);
  const hasIntId = /\b(id|user_id|account_id)\s*:\s*int\b|Column\([^\)]*Integer\b/.test(content);
  if (hasUuid && hasIntId) {
    findings.push({ kind: 'id_type_divergence', scope: 'package', file: relpath, message: 'Mixed UUID and int identifier types detected', meta: { detector: 'regex' } });
  }
  return findings;
}


