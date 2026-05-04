import { Finding } from '../types';

export const id = 'money_precision_risk';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // look for fields named amount or money with float type
  if (/\b(amount|price|cost|total)\b[\s\S]{0,40}float\b/i.test(content) || /\bFloat\b/.test(content) && /\b(amount|price|cost|total)\b/i.test(content)) {
    findings.push({ kind: 'money_precision_risk', scope: 'file', file: relpath, message: 'Money field using float detected', meta: { detector: 'regex' } });
  }
  return findings;
}


