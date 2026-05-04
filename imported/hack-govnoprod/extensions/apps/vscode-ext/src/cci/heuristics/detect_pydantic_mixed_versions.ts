import { Finding } from '../types';

export const id = 'pydantic_mixed_versions';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const hasV2 = /\bfield_validator\b|\bmodel_validate_json\b/.test(content);
  const hasV1 = /\b(BaseModel\b|@validator\b)/.test(content);
  if (hasV1 && hasV2) {
    findings.push({ kind: 'pydantic_mixed_versions', scope: 'project', message: 'Mixed Pydantic v1 and v2 patterns detected', file: relpath, meta: { detector: 'regex' } });
  }
  return findings;
}


