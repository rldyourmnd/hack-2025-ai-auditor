import { Finding } from '../types';

export const id = 'json_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const libs = new Set<string>();
  if (/\bimport\s+json\b/.test(content) || /\bfrom\s+json\b/.test(content)) libs.add('json');
  if (/\bimport\s+ujson\b/.test(content) || /\bfrom\s+ujson\b/.test(content)) libs.add('ujson');
  if (/\bimport\s+orjson\b/.test(content) || /\bfrom\s+orjson\b/.test(content)) libs.add('orjson');

  if (libs.size > 1) {
    findings.push({ kind: 'json_divergence', scope: 'package', file: relpath, message: 'Multiple JSON libraries detected', meta: { detector: 'regex', libs: Array.from(libs) } });
  }
  return findings;
}


