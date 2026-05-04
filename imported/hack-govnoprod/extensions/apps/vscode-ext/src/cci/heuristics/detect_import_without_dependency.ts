import { Finding } from '../types';

export const id = 'import_without_dependency';

// Stub — requires reading package manifests; return empty
export function run(content: string, relpath: string): Finding[] { return []; }


