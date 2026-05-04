import { Finding } from '../types';

export const id = 'pagination_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // naive: look for common pagination fields
  const hasPage = /\bpage\b/.test(content);
  const hasOffset = /\boffset\b/.test(content);
  const hasCursor = /\bcursor\b/.test(content);
  const styles = [hasPage, hasOffset, hasCursor].filter(Boolean).length;
  if (styles > 1) {
    findings.push({ kind: 'pagination_divergence', scope: 'package', file: relpath, message: 'Multiple pagination styles detected', meta: { detector: 'regex' } });
  }
  return findings;
}


