import { Finding } from '../types';

export const id = 'error_format_divergence';

// Heuristic: flag if multiple common error keys/patterns appear in a file (error vs errors vs message)
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const patterns = new Set<string>();
  if (/"error"\s*:\s*/.test(content) || /\berror\b\s*=/.test(content)) patterns.add('error');
  if (/"errors"\s*:\s*/.test(content) || /\berrors\b\s*=/.test(content)) patterns.add('errors');
  if (/"message"\s*:\s*/.test(content) || /\bmessage\b\s*=/.test(content)) patterns.add('message');

  if (patterns.size > 1) {
    findings.push({ kind: 'error_format_divergence', scope: 'file', file: relpath, message: 'Multiple error response formats detected in file', meta: { detector: 'regex', formats: Array.from(patterns) } });
  }
  return findings;
}


