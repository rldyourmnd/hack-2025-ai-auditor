import { Finding } from '../types';

export const id = 'regex.import_layer_violation';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  const mods = new Set<string>();
  const importRe = /(?:from|import)\s+([\w\.\-/]+)/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content))) mods.add(m[1]);

  const layerOf = (mod: string) => {
    if (/\bapi\b/.test(mod) || /\/api\//.test(mod)) return 'api';
    if (/\brepo\b/.test(mod) || /\/repo\//.test(mod)) return 'repo';
    if (/\bmodels?\b/.test(mod) || /\/models?\//.test(mod)) return 'models';
    if (/\bservice\b/.test(mod) || /\/services?\//.test(mod)) return 'services';
    if (/\bdb\b/.test(mod) || /\/db\//.test(mod)) return 'db';
    return null;
  };

  const layers = new Set<string>();
  for (const mod of mods) {
    const L = layerOf(mod);
    if (L) layers.add(L);
  }

  if (layers.has('api') && layers.has('repo')) {
    findings.push({ kind: 'import_layer_violation', scope: 'file', file: relpath, message: 'Import between API and repository layer detected', context: 'api->repo', meta: { detector: 'regex' } });
  }

  return findings;
}


