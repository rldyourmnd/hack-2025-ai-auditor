import * as fs from 'fs';
import * as path from 'path';

export interface ShotgunOptions {
  include: string[];
  exclude: string[];
  maxFiles: number;
  maxFileKB: number;
}

type CancelLike = { isCancellationRequested: boolean } | undefined;

export async function packShotgun(rootDir: string, opts: ShotgunOptions, logger?: (msg: string) => void, token?: CancelLike, extensionRoot?: string, auditDir?: string): Promise<string> {
  // determine target directory for output (prefer auditDir or configured audit.directory)
  let targetDir = auditDir || '';
  if (!targetDir) {
    try {
      const cfg = require('vscode').workspace.getConfiguration();
      // prefer new default '.auditor' over legacy '.audit'
      const rel = ((cfg.get('audit.directory') as unknown) as string) || '.auditor';
      targetDir = path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
    } catch {
      targetDir = path.join(rootDir, '.auditor');
    }
  }
  try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}
  const outPath = path.join(targetDir, 'project-map.xml');
  logger?.(`Shotgun packing: root="${rootDir}", files<=${opts.maxFiles}, size<=${opts.maxFileKB}KB`);

  // load .gitignore
  let gitignoreText = '';
  try { gitignoreText = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8'); } catch {}

  let fg: any, ignoreFactory: any;
  try {
    const fgMod = await import('fast-glob');
    fg = fgMod.default ?? fgMod;
  } catch (e) {
    logger?.(`fast-glob import failed: ${String((e as any)?.message || e)}`);
    try { fg = require(path.join(__dirname, '..', '..', 'node_modules', 'fast-glob')); } catch (er) { logger?.(`fast-glob require fallback failed: ${String((er as any)?.message || er)}`); }
  }
  try {
    const ignMod = await import('ignore');
    ignoreFactory = ignMod.default ?? ignMod;
  } catch (e) {
    logger?.(`ignore import failed: ${String((e as any)?.message || e)}`);
    try { ignoreFactory = require(path.join(__dirname, '..', '..', 'node_modules', 'ignore')); } catch (er) { logger?.(`ignore require fallback failed: ${String((er as any)?.message || er)}`); }
  }
  if (!fg || !ignoreFactory) {
    // try install into extensionRoot if provided
    if (extensionRoot) {
      try {
        logger?.('fast-glob/ignore not available - attempting npm install in extension folder');
        const { execSync } = await import('child_process');
        execSync('npm install --no-audit --no-fund fast-glob@^3.3.3 ignore@^5.3.2', { cwd: extensionRoot, stdio: 'inherit' });
        // retry require/import
        try { const fgMod = await import('fast-glob'); fg = fgMod.default ?? fgMod; } catch {}
        try { const ignMod = await import('ignore'); ignoreFactory = ignMod.default ?? ignMod; } catch {}
      } catch (e: any) {
        logger?.(`fast-glob/ignore install fallback failed: ${String(e?.message || e)}`);
      }
    }
  }
  if (!fg) throw new Error('fast-glob not available');
  if (!ignoreFactory) throw new Error('ignore not available');
  const ign = ignoreFactory();
  if (gitignoreText) ign.add(gitignoreText);
  if (opts.exclude && opts.exclude.length) ign.add(opts.exclude);

  // collect candidates
  logger?.(`Shotgun: fast-glob include globs: ${JSON.stringify(opts.include)}`);
  const entries: string[] = await fg(opts.include && opts.include.length ? opts.include : ['**/*'], {
    cwd: rootDir,
    dot: false,
    onlyFiles: false,
    followSymbolicLinks: false,
    unique: true,
    suppressErrors: true,
  });

  const files: string[] = [];
  for (const rel of entries) {
    if (token?.isCancellationRequested) throw new Error('Canceled');
    const normalized = rel.replace(/\\/g, '/');
    if (ign.ignores(normalized)) continue;
    const abs = path.join(rootDir, rel);
    let st: fs.Stats;
    try { st = fs.lstatSync(abs); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (!st.isFile()) continue;
    files.push(normalized);
    if (files.length >= opts.maxFiles) break;
  }

  logger?.(`Shotgun: candidate files after filtering: ${files.length}`);

  const blocks: string[] = [];
  let includedCount = 0;
  for (const rel of files) {
    if (token?.isCancellationRequested) throw new Error('Canceled');
    const abs = path.join(rootDir, rel);
    let st: fs.Stats;
    try { st = fs.statSync(abs); } catch { continue; }
    if (st.size > opts.maxFileKB * 1024) continue;
    let text = '';
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    // Replace invalid surrogates implicitly by UTF-8 decoder in Node; if exception, we already caught
    blocks.push(`<file path="${rel}">\n${text}\n</file>`);
    includedCount++;
  }

  logger?.(`Shotgun: files included after size filter: ${includedCount}`);

  const output = `# Project Map (Shotgun-style)\n\n<directory_structure>\n${files.join('\n')}\n</directory_structure>\n\n<files>\n${blocks.join('\n')}\n</files>\n`;
  fs.writeFileSync(outPath, output, 'utf8');

  // output is written directly into targetDir (resolved audit dir)

  logger?.(`Shotgun packing done: listed=${files.length}, included=${includedCount}, out=${outPath}`);
  return outPath;
}


