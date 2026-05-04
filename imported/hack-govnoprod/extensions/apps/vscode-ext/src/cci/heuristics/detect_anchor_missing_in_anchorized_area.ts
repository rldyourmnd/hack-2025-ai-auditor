import { Finding } from '../types';

export const id = 'anchor_missing_in_anchorized_area';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // naive: check for presence of @anchor: in files under docs/ or anchorized areas
  if (/docs\//.test(relpath) && !/@anchor:/.test(content)) {
    findings.push({ kind: 'anchor_missing_in_anchorized_area', scope: 'file', file: relpath, message: 'Anchor missing in anchorized area', meta: { detector: 'regex' } });
  }
  return findings;
}


