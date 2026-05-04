import { Finding } from '../types';

export const id = 'module_naming_violation';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // check filename pattern from relpath
  const name = relpath.split('/').pop() || '';
  if (!/^[a-z0-9_\.\-]+$/.test(name)) findings.push({ kind: 'module_naming_violation', scope: 'file', file: relpath, message: `Module name ${name} violates naming pattern`, meta: { detector: 'regex' } });
  return findings;
}


