import { Finding } from '../types';

export const id = 'enum_values_mismatch';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const hasPyEnum = /\bclass\s+\w*Enum\b|\bEnum\(/.test(content);
  const hasSqlEnum = /\bCREATE\s+TYPE\s+\w+\s+AS\s+ENUM\b/i.test(content);
  if (hasPyEnum && hasSqlEnum) {
    findings.push({ kind: 'enum_values_mismatch', scope: 'file', file: relpath, message: 'Both Python Enum and SQL ENUM present (possible mismatch)', meta: { detector: 'regex' } });
  }
  return findings;
}


