import { Finding } from '../types';

export const id = 'env_unused';

// Stub: requires scanning .env.example vs codebase usage; return empty for now
export function run(content: string, relpath: string): Finding[] { return []; }


