import { Finding } from '../types';

export function detectOrmPydantic(content: string, relpath: string): Finding[] {
  const f: Finding[] = [];
  const hasSqlalchemy = /\b(import|from)\s+sqlalchemy\b/.test(content);
  const hasPydantic = /\b(from|import)\s+pydantic\b/.test(content);
  if (hasSqlalchemy && hasPydantic) f.push({ kind: 'layer_bleed_model_api', scope: 'file', file: relpath, message: 'ORM and Pydantic in same file', context: 'sqlalchemy+pydantic', meta: { detector: 'regex' } });
  return f;
}

export function detectDbRawInApi(content: string, relpath: string): Finding[] {
  const f: Finding[] = [];
  const hasApi = /\b(APIRouter|@app\.|router\.)/.test(content);
  const hasRaw = /\b(psycopg2|asyncpg|pymysql)\b/.test(content);
  if (hasApi && hasRaw) f.push({ kind: 'layer_bleed_db_raw_in_api', scope: 'file', file: relpath, message: 'Raw DB access in API handler', meta: { detector: 'regex' } });
  return f;
}

export function detectBlockingInAsync(content: string, relpath: string): Finding[] {
  const f: Finding[] = [];
  const asyncBlocks = content.split(/\n(?=\s*async\s+def\s+)/i).filter(Boolean);
  for (const blk of asyncBlocks) {
    if (/requests\.|subprocess\.run\(|open\(/.test(blk)) f.push({ kind: 'blocking_call_in_async', scope: 'file', file: relpath, message: 'Blocking call inside async function', meta: { detector: 'regex' } });
  }
  return f;
}

export function detectImportLayerViolation(content: string, relpath: string): Finding[] {
  const f: Finding[] = [];
  // collect module tokens from import statements
  const mods = new Set<string>();
  const importRe = /(?:from|import)\s+([\w\.\-/]+)/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content))) {
    mods.add(m[1]);
  }

  // simple layer keyword map
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

  // if both api and repo present — flag as import layer violation
  if (layers.has('api') && layers.has('repo')) {
    f.push({ kind: 'import_layer_violation', scope: 'file', file: relpath, message: 'Import between API and repository layer detected', context: 'api->repo', meta: { detector: 'regex' } });
  }
  return f;
}


