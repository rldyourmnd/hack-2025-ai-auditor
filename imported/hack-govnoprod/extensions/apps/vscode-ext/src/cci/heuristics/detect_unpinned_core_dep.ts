import { Finding } from '../types';

export const id = 'unpinned_core_dep';

// Stub — needs scanning pyproject/requirements; return empty
export function run(content: string, relpath: string): Finding[] { return []; }


