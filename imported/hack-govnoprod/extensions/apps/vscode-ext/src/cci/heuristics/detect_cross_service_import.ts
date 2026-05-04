import { Finding } from '../types';

export const id = 'cross_service_import';
export const extensions = ['.py'];

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // detect imports like services/A/... importing services/B/...
  const importRe = /(?:from|import)\s+([\w\.\-/]+)/g;
  const mods: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content))) mods.push(m[1]);

  const svcRe = /services\/([^\/]+)/;
  const services = new Set<string>();
  for (const mod of mods) {
    const mm = svcRe.exec(mod);
    if (mm) services.add(mm[1]);
  }

  if (services.size > 1) {
    findings.push({ kind: 'cross_service_import', scope: 'file', file: relpath, message: 'Imports from multiple services detected', meta: { detector: 'regex', services: Array.from(services) } });
  }
  return findings;
}


