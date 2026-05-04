import { Finding } from '../types';

export const id = 'client_divergence_http';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const clients = new Set<string>();
  if (/\bimport\s+requests\b/.test(content) || /\bfrom\s+requests\b/.test(content)) clients.add('requests');
  if (/\bimport\s+httpx\b/.test(content) || /\bfrom\s+httpx\b/.test(content)) clients.add('httpx');
  if (/\bimport\s+aiohttp\b/.test(content) || /\bfrom\s+aiohttp\b/.test(content)) clients.add('aiohttp');

  if (clients.size > 1) {
    findings.push({ kind: 'client_divergence_http', scope: 'package', file: relpath, message: 'Multiple HTTP client libraries detected', meta: { detector: 'regex', clients: Array.from(clients) } });
  }
  return findings;
}


