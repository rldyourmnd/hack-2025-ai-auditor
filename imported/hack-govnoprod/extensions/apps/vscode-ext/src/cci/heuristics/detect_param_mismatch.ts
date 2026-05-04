import { Finding } from '../types';

export const id = 'param_mismatch';

// Naive heuristic: look for route decorator with path params and check following function signature for matching arg names
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const routeRe = /@(?:app|router)\.(?:get|post|put|patch|delete)\((?:r?['"])([^'"\)]*)(?:['"])\)/g;
  const funcRe = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  const routes: string[] = [];
  while ((m = routeRe.exec(content))) {
    routes.push(m[1]);
    lastIndex = m.index + m[0].length;
  }
  if (routes.length === 0) return findings;

  // find first function after each route decorator
  for (const route of routes) {
    const routeParams = Array.from(route.matchAll(/\{([^}]+)\}/g)).map(r => r[1]);
    // find next def after the route occurrence
    const idx = content.indexOf(route);
    if (idx < 0) continue;
    funcRe.lastIndex = idx;
    const f = funcRe.exec(content);
    if (!f) continue;
    const args = (f[2] || '').split(',').map(s => s.split(':')[0].trim()).filter(Boolean).map(a => a.replace(/self\b/, '').trim());
    // compare
    for (const rp of routeParams) {
      if (!args.includes(rp)) {
        findings.push({ kind: 'param_mismatch', scope: 'file', file: relpath, message: `Route param {${rp}} not found in handler args`, context: route, meta: { detector: 'regex' } });
      }
    }
  }
  return findings;
}


