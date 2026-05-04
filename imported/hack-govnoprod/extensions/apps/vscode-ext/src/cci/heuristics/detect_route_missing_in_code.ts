import { Finding } from '../types';

export const id = 'route_missing_in_code';

// Note: minimal implementation — expects OpenAPI paths to be provided in meta or config; here we only stub a detector
export function run(content: string, relpath: string): Finding[] {
  // cannot detect without OpenAPI spec; return empty
  return [];
}


