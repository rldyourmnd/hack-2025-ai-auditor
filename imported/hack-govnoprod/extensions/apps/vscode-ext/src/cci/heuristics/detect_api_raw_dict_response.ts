import { Finding } from '../types';

export const id = 'api_raw_dict_response';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // FastAPI-like patterns returning plain dict instead of Response/Model
  const routeRe = /@(?:app|router)\.(?:get|post|put|patch|delete)\([^)]*\)\s*\n\s*def\s+\w+\([^)]*\):([\s\S]*?)(?=\n\S|$)/g;
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(content))) {
    const body = m[1] || '';
    if (/return\s+\{[^}]*\}/.test(body)) findings.push({ kind: 'api_raw_dict_response', scope: 'file', file: relpath, message: 'Handler returns raw dict; prefer schema/Response', meta: { detector: 'regex' } });
  }
  return findings;
}


