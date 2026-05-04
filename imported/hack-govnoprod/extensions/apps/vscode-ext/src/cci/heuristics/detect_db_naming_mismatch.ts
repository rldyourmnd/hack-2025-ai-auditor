import { Finding } from '../types';

export const id = 'db_naming_mismatch';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // detect snake_case violations in SQL/DDL-like content
  const bad = /\b[A-Z][A-Za-z0-9]*\b/g;
  const m = content.match(bad);
  if (m && m.length > 5) {
    findings.push({ kind: 'db_naming_mismatch', scope: 'file', file: relpath, message: 'Possible DB naming violations detected', meta: { detector: 'regex', samples: m.slice(0,5) } });
  }
  return findings;
}


