import { Finding } from '../types';

export const id = 'weak_semantic_type';

export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  // find string fields named like email/url without validators
  const fieldRe = /(\b\w+\b)\s*[:=]\s*str\b/g;
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(content))) {
    const name = m[1];
    if (/email|url|uri|phone|address/i.test(name)) {
      // check for nearby validator keywords
      const window = content.substr(Math.max(0, m.index - 200), 400);
      if (!/validator|validate|EmailStr|AnyUrl|HttpUrl/.test(window)) {
        findings.push({ kind: 'weak_semantic_type', scope: 'file', file: relpath, message: `Field ${name} lacks semantic validators`, meta: { detector: 'regex' } });
      }
    }
  }
  return findings;
}


