import { Finding } from '../types';

export const id = 'event_topic_divergence';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const topics = Array.from(content.matchAll(/\btopic[s]?\b[:=]?\s*['\"]?([a-zA-Z0-9_\-\.\/]+)['\"]?/gi)).map(m => m[1]).filter(Boolean);
  const uniq = Array.from(new Set(topics));
  if (uniq.length > 1) findings.push({ kind: 'event_topic_divergence', scope: 'package', file: relpath, message: `Multiple event topics detected: ${uniq.slice(0,5).join(',')}`, meta: { detector: 'regex', samples: uniq.slice(0,5) } });
  return findings;
}


