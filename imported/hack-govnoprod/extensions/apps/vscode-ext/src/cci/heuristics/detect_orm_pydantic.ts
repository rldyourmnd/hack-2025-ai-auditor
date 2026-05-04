import { Finding } from '../types';

export const id = 'regex.orm_pydantic';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const hasSqlalchemy = /\b(import|from)\s+sqlalchemy\b/.test(content);
  const hasPydantic = /\b(from|import)\s+pydantic\b/.test(content);
  if (hasSqlalchemy && hasPydantic) {
    findings.push({ kind: 'layer_bleed_model_api', scope: 'file', file: relpath, message: 'ORM and Pydantic in same file', context: 'sqlalchemy+pydantic', meta: { detector: 'regex' } });
  }
  return findings;
}