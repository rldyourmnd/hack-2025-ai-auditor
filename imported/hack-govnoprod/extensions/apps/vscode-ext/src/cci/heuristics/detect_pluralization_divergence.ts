import { Finding } from '../types';

export const id = 'pluralization_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const parts = relpath.split('/');
  const pluralParts = parts.filter(p => p.endsWith('s'));
  const singularParts = parts.filter(p => !p.endsWith('s'));
  if (pluralParts.length && singularParts.length) {
    findings.push({ kind: 'pluralization_divergence', scope: 'project', file: relpath, message: 'Mixed plural/singular directory names detected', meta: { detector: 'regex', examples: [pluralParts[0], singularParts[0]] } });
  }
  return findings;
}


