import { Finding } from '../types';

export const id = 'sample_length_check';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split(/\r?\n/).length;
  if (lines > 500) {
    findings.push({ kind: 'large_file', scope: 'file', file: relpath, context: `lines=${lines}`, message: 'File exceeds 500 lines' });
  }
  if (/password|api[_\- ]?key/i.test(content)) {
    findings.push({ kind: 'possible_secret', scope: 'file', file: relpath, message: 'Possible secret-like token found' });
  }
  return findings;
}


