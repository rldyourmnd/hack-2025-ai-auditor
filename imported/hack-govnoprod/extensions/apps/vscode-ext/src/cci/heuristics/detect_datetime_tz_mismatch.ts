import { Finding } from '../types';

export const id = 'datetime_tz_mismatch';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // detect datetime.now() without timezone or calls to datetime.utcnow()
  if (/\bdatetime\.now\(\)\b/.test(content) && !/\bdatetime\.now\(tz=\w+\)/.test(content)) {
    findings.push({ kind: 'datetime_tz_mismatch', scope: 'file', file: relpath, message: 'datetime.now() used without timezone', meta: { detector: 'regex' } });
  }
  if (/\bdatetime\.utcnow\(\)/.test(content)) {
    findings.push({ kind: 'datetime_tz_mismatch', scope: 'file', file: relpath, message: 'datetime.utcnow() used (prefer timezone-aware)', meta: { detector: 'regex' } });
  }
  return findings;
}


