import { Finding } from '../types';

export const id = 'db_access_divergence';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const approaches = new Set<string>();
  if (/\bimport\s+sqlalchemy\b/.test(content) || /\bfrom\s+sqlalchemy\b/.test(content)) approaches.add('sqlalchemy');
  if (/\bimport\s+asyncpg\b/.test(content) || /\bfrom\s+asyncpg\b/.test(content)) approaches.add('raw');
  if (/\bimport\s+psycopg2\b/.test(content) || /\bfrom\s+psycopg2\b/.test(content)) approaches.add('raw');

  if (approaches.size > 1) {
    findings.push({ kind: 'db_access_divergence', scope: 'package', file: relpath, message: 'Multiple DB access approaches detected', meta: { detector: 'regex', approaches: Array.from(approaches) } });
  }
  return findings;
}


