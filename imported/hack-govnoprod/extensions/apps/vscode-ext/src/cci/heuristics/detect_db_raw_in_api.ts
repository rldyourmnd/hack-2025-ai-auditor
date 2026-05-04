import { Finding } from '../types';

export const id = 'regex.db_raw_in_api';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const hasApi = /\b(APIRouter|@app\.|router\.)/.test(content);
  const hasRaw = /\b(psycopg2|asyncpg|pymysql)\b/.test(content);
  if (hasApi && hasRaw) {
    findings.push({ kind: 'layer_bleed_db_raw_in_api', scope: 'file', file: relpath, message: 'Raw DB access in API handler', meta: { detector: 'regex' } });
  }
  return findings;
}


