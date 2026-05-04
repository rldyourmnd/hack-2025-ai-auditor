import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as vscode from "vscode";
import * as os from "os";
import { Heuristic, HeuristicContext, FileStat, Finding } from "./types";
import { loadHeuristicsFromDir } from "./heuristicRegistry";
import { loadCciConfig } from "./config";

async function sha256(content: string) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function isTextFile(file: string) {
  // basic extension check
  return /\.(py|sql|yml|yaml|json|toml|ts|js|jsx|tsx|md)$/.test(file);
}

function countLines(content: string, ext: string) {
  // remove block comments/strings for more accurate non-blank counting
  let s = content;
  try {
    // remove Python triple-quoted strings ('''...''' or """..."")
    s = s.replace(/('{3}|\"{3})[\s\S]*?\1/g, '\n');
  } catch {}
  // remove SQL block comments /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '\n');
  const lines = s.split(/\r?\n/);
  let nonBlank = 0;
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if ((ext === '.py' || ext === '.yaml' || ext === '.yml' || ext === '.toml') && t.startsWith('#')) continue;
    if (ext === '.sql' && (t.startsWith('--') || t.startsWith('/*') || t.endsWith('*/'))) continue;
    nonBlank++;
  }
  return { lines: lines.length, nonBlankLines: nonBlank };
}

export async function collectFindings(workspaceRoot?: string, log?: (msg: string) => void) {
  const root = workspaceRoot || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || process.cwd();
  const config = loadCciConfig(root);
  // Prefer external heuristics if configured, otherwise fall back to bundled src path during dev.
  // Note: In packaged extension, __dirname/heuristics is used below.
  const heuristicsDir = config.externalHeuristicsPath && fs.existsSync(config.externalHeuristicsPath)
    ? config.externalHeuristicsPath
    : path.join(root, "extensions", "apps", "vscode-ext", "src", "cci", "heuristics");
  const bundledDir = path.join(__dirname, "heuristics");
  const heuristics = loadHeuristicsFromDir(bundledDir).concat(loadHeuristicsFromDir(heuristicsDir));

  const fileStats: FileStat[] = [];
  const findings: Finding[] = [];

  // simple in-memory cache for fileHash -> findings
  const fileCache = new Map<string, Finding[]>();

  // Use VSCode workspace file search (non-blocking) and respect ignore patterns
  try {
    const excludeGlob = (config.ignorePatterns || []).length ? `{${(config.ignorePatterns || []).map(p => p.replace(/\\/g, '/')).join(',')}}` : undefined;
    // determine allowed extensions from heuristics to limit file scanning
    const cfgMap = config.heuristicFileMap || {};
    const defaultExts = config.defaultHeuristicExtensions || ['.py'];
    const fileHeuristicsPre = heuristics.filter((x) => x.scope === 'file').map(h => ({ h, exts: (h as any).extensions && (h as any).extensions.length ? (h as any).extensions : (cfgMap[(h as any).id] || defaultExts) }));
    // enforce python-only scanning unless user configured otherwise
    const allowedExtsFromHeur = new Set<string>();
    for (const it of fileHeuristicsPre) for (const e of it.exts) allowedExtsFromHeur.add(e.startsWith('.') ? e : `.${e}`);
    const allowedExtsFinal = new Set<string>(['.py']);
    // allow other extensions only if explicitly present in config.heuristicFileMap
    for (const v of Object.values(cfgMap)) for (const e of v) allowedExtsFinal.add(e.startsWith('.') ? e : `.${e}`);
    // create list of uris by extension
    const uriSet = new Map<string, vscode.Uri>();
    for (const e of Array.from(allowedExtsFinal)) {
      try {
        const pattern = `**/*${e}`;
        const found = await vscode.workspace.findFiles(pattern, excludeGlob, 200000);
        for (const u of found) uriSet.set(u.fsPath, u);
      } catch (err) { if (log) log(`collector: findFiles for ${e} failed: ${String((err as any)?.message||err)}`); }
    }
    let uris = Array.from(uriSet.values());
    // Cap number of files if configured
    const maxFiles = (config as any).maxFiles && Number((config as any).maxFiles) > 0 ? Number((config as any).maxFiles) : undefined;
    if (maxFiles && uris.length > maxFiles) {
      uris = uris.slice(0, maxFiles);
      if (log) log(`collector: capped candidate files to maxFiles=${maxFiles}`);
    }
    if (log) log(`collector: found ${uris.length} candidate files (extensions: ${Array.from(allowedExtsFinal).join(',')})`);
    // skip heavy heuristics in per-file pass
    const heavyIds = new Set<string>(['repo_import_graph']);
    // Always skip heavy heuristics in per-file pass to avoid stalls; they can run in finalize.
    const fileHeuristics = fileHeuristicsPre.filter(it => !heavyIds.has((it.h as any).id));
    const configured = (config as any).concurrency && Number((config as any).concurrency) > 0 ? Number((config as any).concurrency) : undefined;
    const cpuCount = (() => { try { return os.cpus().length; } catch { return 2; } })();
    const defaultConcurrency = Math.max(2, Math.min(8, Math.floor(cpuCount / 2)));
    const CONCURRENCY = configured || defaultConcurrency;
    let processed = 0;
    const startAll = Date.now();
    if (log) log(`collector: processing ${uris.length} files with concurrency=${CONCURRENCY} (cpu=${cpuCount}, configured=${configured||'unset'})`);

    // track pending files to help debugging hangs
    const pending = new Map<string, number>();
    const heartbeatInterval = setInterval(() => {
      try {
        if (!log) return;
        const now = Date.now();
        const stuck: string[] = [];
        for (const [p, t] of pending.entries()) {
          if (now - t > (config.fileTimeoutMs || 5000) * 2) stuck.push(p);
        }
        if (stuck.length) log(`collector: heartbeat - ${stuck.length} files pending > ${Math.round(((config.fileTimeoutMs||5000)*2)/1000)}s (examples: ${stuck.slice(0,5).map(s=>s.replace(root+'/', '')).join(', ')})`);
      } catch (e) {}
    }, 5000);

    async function processOne(u: vscode.Uri) {
      const fileStart = Date.now();
      try {
        if (log && (processed < 20)) log(`collector: start ${u.fsPath}`);
        pending.set(u.fsPath, Date.now());
        const full = u.fsPath;
        const rel = path.relative(root, full).replace(/\\/g, '/');
        const name = path.basename(full);
        if (!isTextFile(name)) return;
        // enforce per-file timeout
        const filePromise = (async () => await vscode.workspace.fs.readFile(u))();
        const timeoutMs = config.fileTimeoutMs || 5000;
        const raw = await Promise.race([filePromise, new Promise<Uint8Array>((_, rej) => setTimeout(() => rej(new Error('file-read-timeout')), timeoutMs))]);
        const content = Buffer.from(raw).toString('utf8');
        const hash = await sha256(content);
        const ext = path.extname(name).toLowerCase();
        const counts = countLines(content, ext);
        const stat: FileStat = { path: full, relpath: rel, lines: counts.lines, nonBlankLines: counts.nonBlankLines, hash };
        fileStats.push(stat);

        if (fileCache.has(hash)) {
          const fromCache = fileCache.get(hash) || [];
          findings.push(...fromCache);
          if (log && (processed < 20)) log(`collector: cache hit ${rel} -> ${fromCache.length} findings`);
        } else {
          const perFileFindings: Finding[] = [];
          // prepare ctx once per file
          const ctx: HeuristicContext = {
            root,
            config,
            readFile: async (r) => Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(root, r)))).toString('utf8'),
            fileStat: async (r) => fileStats.find((s) => s.relpath === r),
          };
          for (const item of fileHeuristics) {
            const h = item.h;
            const allowedExts = item.exts || defaultExts;
            try {
              if (!allowedExts.includes(ext)) continue; // skip if current file ext not allowed
              if (log && (processed < 10)) log(`collector: running heuristic ${h.id} on ${rel}`);
              // per-heuristic timeout
              const heurTimeoutMs = Math.max(500, (config.fileTimeoutMs || 5000));
              const runPromise = (async () => await h.run(ctx, { file: rel, content }))();
              const res = await Promise.race([runPromise, new Promise<any>((_, rej) => setTimeout(() => rej(new Error('heuristic-timeout')), heurTimeoutMs))]);
              if (Array.isArray(res) && res.length) {
                perFileFindings.push(...res);
                if (log && (processed < 20)) log(`collector: heuristic ${h.id} produced ${res.length} findings for ${rel}`);
              }
            } catch (err) {
              if (log) log(`collector: heuristic ${h.id} failed on ${rel}: ${String((err as any)?.message || err)}`);
            }
          }
          fileCache.set(hash, perFileFindings);
          findings.push(...perFileFindings);
        }
      } catch (err) {
        if (log) log(`collector: file ${u.fsPath} processing error: ${String((err as any)?.message || err)}`);
      }
      finally {
        pending.delete(u.fsPath);
        processed++;
        const dur = Date.now() - fileStart;
        if (log && (processed < 20)) log(`collector: finished ${u.fsPath} in ${dur}ms`);
        if (log && processed % 200 === 0) log(`collector: processed ${processed}/${uris.length} (elapsed ${Math.round((Date.now()-startAll)/1000)}s)`);
      }
    }
    const batchTimeout = config.batchTimeoutMs || 30000;
    for (let i = 0; i < uris.length; i += CONCURRENCY) {
      const batch = uris.slice(i, i + CONCURRENCY);
      const idxStart = i + 1;
      const idxEnd = i + batch.length;
      if (log) log(`collector: starting batch ${idxStart}-${idxEnd}`);
      try {
        await Promise.race([
          Promise.all(batch.map((u) => processOne(u))),
          new Promise((_, rej) => setTimeout(() => rej(new Error('batch-timeout')), batchTimeout))
        ] as any);
        if (log) log(`collector: finished batch ${idxStart}-${idxEnd}`);
        // yield to event loop to keep the extension host responsive
        await new Promise((res) => setTimeout(res, 10));
      } catch (err) {
        if (log) log(`collector: batch ${idxStart}-${idxEnd} failed/timeout: ${String((err as any)?.message || err)}`);
        // dump pending examples to help troubleshooting
        try {
          const now = Date.now();
          const pendingList = Array.from(pending.keys()).slice(0, 20);
          if (pendingList.length && log) log(`collector: pending files at timeout (examples): ${pendingList.map(p => p.replace(root + '/', '')).join(', ')}`);
        } catch (e) {}
      }
    }
    clearInterval(heartbeatInterval);
  } catch (e) {
    // fallback: no files found
  }

  // finalize heuristics (package/repo)
  // prepare helper functions for context
  // Finalize helpers guarded by timeouts to avoid hangs
  async function withTimeout<T>(p: Promise<T>, ms: number, tag: string): Promise<T | null> {
    try {
      return await Promise.race([
        p,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ] as any);
    } catch {
      return null;
    }
  }

  const importGraph = await withTimeout((async () => {
    try {
      const mod = require('./utils/importGraph');
      return await mod.buildImportGraph();
    } catch { return { nodes: [], edges: [] }; }
  })(), config.timeoutMs || 10000, 'importGraph') || { nodes: [], edges: [] };
  const openapis = await withTimeout((async () => {
    try {
      const mod = require('./utils/openapiLoader');
      return await mod.findOpenApiSpecs();
    } catch { return []; }
  })(), config.timeoutMs || 10000, 'openapiFind') || [];

  for (const h of heuristics) {
    if (typeof h.finalize !== 'function') continue;
    try {
      const ctx: HeuristicContext = {
        root,
        config,
        readFile: async (r) => fs.readFileSync(path.join(root, r), "utf8"),
        fileStat: async (r) => fileStats.find((s) => s.relpath === r),
        getImportGraph: async () => importGraph,
        findOpenApiSpecs: async () => openapis,
        loadOpenApi: async (uri: any) => {
          try { const mod = require('./utils/openapiLoader'); return await mod.loadOpenApi(uri); } catch { return null; }
        }
      };
      const finalizeTimeout = Math.max(2000, (config.timeoutMs || 10000));
      const extra = await withTimeout(h.finalize(ctx, findings.slice()), finalizeTimeout, `finalize:${h.id}`);
      if (Array.isArray(extra) && extra.length) findings.push(...extra);
    } catch (e) {
      // ignore
    }
  }

  // dedupe
  const seen = new Set<string>();
  const dedup: Finding[] = [];
  for (const f of findings) {
    const k = `${f.kind}|${f.file || ""}|${f.line || ""}|${f.context || ""}`;
    if (!seen.has(k)) {
      seen.add(k);
      dedup.push(f);
    }
  }

  // ensure stable ordering
  dedup.sort((a,b) => (a.file || '').localeCompare(b.file || '') || (a.kind || '').localeCompare(b.kind || ''));

  return { fileStats, findings: dedup };
}

// helper to write report to audit directory in workspace
export async function writeReportToWorkspace(root: string, report: any, auditDir?: string) {
  try {
    // prefer configured auditDir if passed; otherwise use global setting 'audit.directory' or default '.audit'
    let target: string = auditDir || '';
    if (!target) {
      try {
        const cfg = require('vscode').workspace.getConfiguration();
        const rel = ((cfg.get('audit.directory') as unknown) as string) || '.audit';
        target = path.isAbsolute(rel) ? rel : path.join(root, rel);
      } catch {
        target = path.join(root, '.audit');
      }
    }
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    const out = path.join(target, `findings_${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
    return out;
  } catch (e) {
    return null;
  }
}


