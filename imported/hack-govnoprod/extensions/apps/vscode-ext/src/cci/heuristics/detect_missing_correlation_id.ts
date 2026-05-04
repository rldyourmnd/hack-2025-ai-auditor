import { Finding } from '../types';

export const id = 'missing_correlation_id';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // Look for logging calls without request id usage — naive heuristic
  if (/logger\./.test(content) && !/request_id|trace_id|x-request-id/.test(content)) {
    findings.push({ kind: 'missing_correlation_id', scope: 'file', file: relpath, message: 'Logging calls without correlation id detected', meta: { detector: 'regex' } });
  }
  return findings;
}


