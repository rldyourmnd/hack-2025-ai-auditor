// Minimal AST parser scaffold using tree-sitter WASM if available, otherwise fallback to Node's built-in parser (acorn not used) — here we provide a simple heuristic using regex for path/role detection.
import * as fs from 'fs';
import * as path from 'path';

export async function parseFileForRole(filePath: string): Promise<{ roleTags: string[]; mainGuard: boolean }> {
  try {
    const src = await fs.promises.readFile(filePath, 'utf8');
    const p = filePath.replace(/\\/g, '/');
    const roleTags: string[] = [];
    const mainGuard = /if\s+__name__\s*==\s*["']__main__["']/.test(src);
    // path heuristics
    if (p.includes('/services/') || p.includes('/service/')) roleTags.push('path_services');
    if (p.includes('/apps/') || p.includes('/app/')) roleTags.push('path_apps');
    if (p.includes('/api/') || p.includes('/handlers/') || p.includes('/routes/')) roleTags.push('path_api');
    if (p.includes('/models/') || p.includes('/domain/')) roleTags.push('path_domain');
    if (p.includes('/tests/unit/') || p.includes('/tests/') || p.includes('/test_')) roleTags.push('path_tests_unit');
    if (p.includes('/migrations/') || p.includes('/alembic/')) roleTags.push('path_migrations');
    if (p.includes('/scripts/') || p.includes('/cli/')) roleTags.push('path_cli');
    if (p.includes('/notebooks/') || filePath.endsWith('.ipynb')) roleTags.push('path_notebooks');
    if (p.includes('/benchmarks/') || p.includes('/benchmark')) roleTags.push('path_benchmarks');
    if (p.includes('/examples/') || p.includes('/sample')) roleTags.push('path_examples');
    if (p.includes('/infra/') || p.includes('/ops/')) roleTags.push('path_infra');
    return { roleTags, mainGuard };
  } catch (e) {
    return { roleTags: [], mainGuard: false };
  }
}

export default { parseFileForRole };


