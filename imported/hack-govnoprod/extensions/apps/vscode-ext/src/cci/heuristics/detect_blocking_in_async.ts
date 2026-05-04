import { Finding } from '../types';

export const id = 'regex.blocking_in_async';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const asyncBlocks = content.split(/\n(?=\s*async\s+def\s+)/i).filter(Boolean);
  for (const blk of asyncBlocks) {
    if (/requests\.|subprocess\.run\(|\bopen\(/.test(blk)) {
      findings.push({ kind: 'blocking_call_in_async', scope: 'file', file: relpath, message: 'Blocking call inside async function', meta: { detector: 'regex' } });
    }
  }
  return findings;
}


