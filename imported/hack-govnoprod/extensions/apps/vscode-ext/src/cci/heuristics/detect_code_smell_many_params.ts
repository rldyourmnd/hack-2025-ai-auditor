import { Finding } from '../types';

export const id = 'code_smell_many_params';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const limit = 6;
  const sigRe = /^\s*def\s+\w+\s*\(([^)]*)\)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = sigRe.exec(content))) {
    const args = (m[1] || '').split(',').map(s => s.trim()).filter(Boolean);
    const pure = args.filter(a => !/^self\b/.test(a));
    if (pure.length > limit) findings.push({ kind: 'code_smell_many_params', scope: 'file', file: relpath, message: `Too many parameters (${pure.length} > ${limit})`, meta: { detector: 'regex' } });
  }
  return findings;
}


