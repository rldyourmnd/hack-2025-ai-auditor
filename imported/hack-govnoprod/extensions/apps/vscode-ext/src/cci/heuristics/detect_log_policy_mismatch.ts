import { Finding } from '../types';

export const id = 'log_policy_mismatch';

// Stub: requires collecting log levels and policies across modules; naive check for explicit level calls
export function run(content: string, relpath: string): Finding[] {
  const findings: Finding[] = [];
  if (/logger\.debug\(|logger\.info\(|logger\.error\(/.test(content)) {
    // could compare across files — return empty for now
  }
  return findings;
}


