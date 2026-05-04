import { Finding } from '../types';

export const id = 'log_format_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const formats = new Set<string>();
  if (/logger\.info\(|logger\.error\(/.test(content)) formats.add('logger');
  if (/structlog\.get_logger\(|structlog\./.test(content)) formats.add('structlog');
  if (/from\s+loguru\s+import\s+logger|loguru\.logger\./.test(content)) formats.add('loguru');

  if (formats.size > 1) {
    findings.push({ kind: 'log_format_divergence', scope: 'package', file: relpath, message: 'Multiple logging formats detected', meta: { detector: 'regex', formats: Array.from(formats) } });
  }
  return findings;
}


