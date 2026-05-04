import { Finding } from '../types';

export const id = 'logger_divergence';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const libs = new Set<string>();
  if (/\bimport\s+logging\b/.test(content) || /\bfrom\s+logging\b/.test(content)) libs.add('logging');
  if (/\bimport\s+structlog\b/.test(content) || /\bfrom\s+structlog\b/.test(content)) libs.add('structlog');
  if (/\bimport\s+loguru\b/.test(content) || /\bfrom\s+loguru\b/.test(content)) libs.add('loguru');

  if (libs.size > 1) {
    findings.push({ kind: 'logger_divergence', scope: 'package', file: relpath, message: 'Multiple logging libraries detected', meta: { detector: 'regex', libs: Array.from(libs) } });
  }
  return findings;
}


