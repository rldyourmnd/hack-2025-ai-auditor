import { Finding } from '../types';

export const id = 'secret_hardcoded';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const secretRe = /(?:api[_\- ]?key|secret|token|passwd)\s*[=:]\s*['\"]([A-Za-z0-9\-_=]+)['\"]/ig;
  let m: RegExpExecArray | null;
  while ((m = secretRe.exec(content))) {
    findings.push({ kind: 'secret_hardcoded', scope: 'file', file: relpath, message: 'Possible hardcoded secret found', meta: { detector: 'regex', sample: m[1] } });
  }
  return findings;
}


