import { Finding } from '../types';

export const id = 'feature_flag_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const patterns = new Set<string>();
  if (/\bis_feature_enabled\b|feature_flags\.get\(/.test(content)) patterns.add('framework');
  if (/\bos\.getenv\(['\"]FEATURE_/.test(content)) patterns.add('env');
  if (/\bflags\[\'|flags\.|get_flag\(/.test(content)) patterns.add('flags_api');

  if (patterns.size > 1) {
    findings.push({ kind: 'feature_flag_divergence', scope: 'package', file: relpath, message: 'Multiple feature flag patterns detected', meta: { detector: 'regex', patterns: Array.from(patterns) } });
  }
  return findings;
}


