import { Finding } from '../types';

export const id = 'code_smell_function_length';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const limit = 80;
  const funcRe = /^\s*def\s+\w+\s*\([^)]*\):[\s\S]*?(?=^\S|\Z)/gm;
  let m: RegExpExecArray | null;
  while ((m = funcRe.exec(content))) {
    const block = m[0];
    const lines = block.split(/\r?\n/).length;
    if (lines > limit) findings.push({ kind: 'code_smell_function_length', scope: 'file', file: relpath, message: `Function too long (${lines} lines > ${limit})`, meta: { detector: 'regex' } });
  }
  return findings;
}


