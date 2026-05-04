import * as path from 'path';
import * as fs from 'fs';

export type RepomixStyle = 'xml' | 'markdown' | 'plain';

type CancelLike = { isCancellationRequested: boolean } | undefined;

import { execSync } from 'child_process';

export async function packWithRepomix(rootDir: string, style: RepomixStyle, compress: boolean, logger?: (msg: string) => void, token?: CancelLike, extensionRoot?: string, auditDir?: string): Promise<string> {
  if (token?.isCancellationRequested) throw new Error('Canceled');
  const ext = style === 'xml' ? 'xml' : style === 'markdown' ? 'md' : 'txt';
  // determine target audit directory (prefer auditDir param, then workspace setting 'audit.directory', default '.auditor')
  let targetAudit = auditDir || '';
  if (!targetAudit) {
    try {
      const cfg = require('vscode').workspace.getConfiguration();
      const rel = ((cfg.get('audit.directory') as unknown) as string) || '.auditor';
      targetAudit = path.isAbsolute(rel) ? rel : path.join(rootDir, rel);
    } catch {
      targetAudit = path.join(rootDir, '.auditor');
    }
  }
  try { fs.mkdirSync(targetAudit, { recursive: true }); } catch {}
  const outPath = path.join(targetAudit, `repomix-output.${ext}`);
  logger?.(`Repomix packing: root="${rootDir}", style=${style}, compress=${compress}, out=${outPath}`);

  // Dynamic import to keep activation light
  // prefer local bundled module first (when packaged, node resolves from extension's node_modules)
  let runCli: any = undefined;
  let packFn: any = undefined;
  try {
    const modLocal: any = await import('repomix');
    packFn = modLocal.pack ?? modLocal.default?.pack;
    if (modLocal?.runCli) {
      runCli = modLocal.runCli;
    } else if (modLocal?.default?.runCli) {
      runCli = modLocal.default.runCli;
    } else {
      // try to load CLI module directly (compiled path)
      try {
        const cliMod = await import('repomix/lib/cli/cliRun.js');
        runCli = cliMod.runCli ?? cliMod.default?.runCli;
      } catch (inner) {
        // fallback to module itself
        runCli = modLocal.default ?? modLocal;
      }
    }
  } catch (e) {
    logger?.(`Repomix import local failed: ${String((e as any)?.message || e)}`);
  }
  // fallback: try dynamic require relative to extension
  if (!runCli) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const localPath = extensionRoot ? path.join(extensionRoot, 'node_modules', 'repomix') : path.join(__dirname, '..', '..', 'node_modules', 'repomix');
      // try CLI module path first
      try {
        const cliReq = require(path.join(localPath, 'lib', 'cli', 'cliRun.js'));
        runCli = cliReq.runCli ?? cliReq.default?.runCli;
      } catch (e1) {
        const modReq = require(localPath);
        runCli = modReq.runCli ?? modReq.default?.runCli ?? modReq;
      }
    } catch (e) {
      logger?.(`Repomix require fallback failed: ${String((e as any)?.message || e)}`);
    }
  }
  // If still not available and extensionRoot provided, try to install deps into extensionRoot
  if (!runCli && extensionRoot) {
    try {
      logger?.('Repomix not available - attempting npm install in extension folder');
      execSync('npm install --no-audit --no-fund repomix@^1.4.0', { cwd: extensionRoot, stdio: 'inherit' });
      const modReq2 = require(path.join(extensionRoot, 'node_modules', 'repomix'));
      runCli = modReq2.runCli ?? modReq2.default?.runCli ?? modReq2;
    } catch (e) {
      logger?.(`Repomix install fallback failed: ${String((e as any)?.message || e)}`);
    }
  }
  if (!runCli) throw new Error('repomix module not available');
  if (typeof runCli !== 'function') {
    throw new Error('Repomix API not found: runCli');
  }
  const options = {
    directories: [rootDir],
    output: outPath,
    style,
    compress,
    quiet: true,
  };
  logger?.(`Repomix runCli options: ${JSON.stringify({ directories: options.directories, style: options.style, compress: options.compress })}`);
  logger?.(`runCli type: ${typeof runCli}, name: ${runCli?.name || '<anon>'}, length: ${runCli?.length}`);
  try { logger?.(`options keys: ${Object.keys(options).join(',')}`); } catch {}
  try {
    // ensure output file dir exists
    try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {}

    // Prefer CLI/run approach first (most robust)
    if (typeof runCli === 'function') {
      logger?.('Calling repomix.runCli (spawn/CLI) as primary');
      // try to locate CLI entry
      let cliPath: string | null = null;
      try {
        const base = extensionRoot ? path.join(extensionRoot, 'node_modules', 'repomix') : path.join(__dirname, '..', '..', 'node_modules', 'repomix');
        const cand = path.join(base, 'bin', 'repomix.cjs');
        if (fs.existsSync(cand)) cliPath = cand;
      } catch (e) { logger?.(`repomix CLI path discovery failed: ${String((e as any)?.message || e)}`); }
      if (!cliPath) {
        try { cliPath = require.resolve('repomix/bin/repomix.cjs'); } catch (e) { logger?.(`require.resolve for repomix CLI failed: ${String((e as any)?.message || e)}`); }
      }
      if (cliPath) {
        const args: string[] = [rootDir, '--output', outPath, '--style', style];
        if (compress) args.push('--compress');
        args.push('--quiet');
        logger?.(`Spawning repomix CLI: ${process.execPath} ${cliPath} ${args.join(' ')}`);
        const { spawn } = await import('child_process');
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath as any, [cliPath as string, ...args], { cwd: rootDir, windowsHide: true });
          const onCancel = () => { try { child.kill(); } catch {} ; reject(new Error('Canceled')); };
          if (token) {
            if (token.isCancellationRequested) return onCancel();
            const sub = (token as any).onCancellationRequested?.(onCancel);
            child.on('exit', () => { try { sub?.dispose?.(); } catch {} });
          }
          child.stdout?.on('data', (d) => { try { const s = String(d).trim(); if (s) logger?.(s); } catch {} });
          child.stderr?.on('data', (d) => { try { const s = String(d).trim(); if (s) logger?.(s); } catch {} });
          child.on('error', (err) => reject(err));
          child.on('close', (code) => { if (code === 0) resolve(); else reject(new Error(`Repomix CLI exited with code ${code}`)); });
        });
      } else {
        // If CLI binary not found, try runCli programmatically
        await runCli(options.directories, rootDir, { output: outPath, style, compress, quiet: true });
      }

    } else if (typeof packFn === 'function') {
      logger?.('Calling repomix.pack (programmatic API) as fallback');
      // Build merged config using repomix config loader (preferred) so all fields exist
      let mergedConfig: any = null;
      try {
        const cfgLoad = await import('repomix/lib/config/configLoad.js');
        let fileConfig: any = {};
        try { fileConfig = await cfgLoad.loadFileConfig(rootDir, null); } catch (e) { logger?.(`loadFileConfig returned no file config (ok): ${String((e as any)?.message || e)}`); fileConfig = {}; }
        const cliConfig: any = { output: { filePath: outPath, style }, include: ['**/*'], ignore: { useDefaultPatterns: true, useGitignore: true, customPatterns: [] } };
        mergedConfig = cfgLoad.mergeConfigs(rootDir, fileConfig, cliConfig);
      } catch (e) { logger?.(`Failed to build merged repomix config via configLoad: ${String((e as any)?.message || e)}`); }
      if (!mergedConfig) mergedConfig = { cwd: rootDir, include: ['**/*'], output: { filePath: outPath, style }, ignore: { useDefaultPatterns: true, useGitignore: true, customPatterns: [] } };
      try { logger?.(`mergedConfig preview: ${JSON.stringify(mergedConfig && { ignore: mergedConfig.ignore, output: mergedConfig.output, include: mergedConfig.include }, null, 2)}`); } catch {}
      try { const dbgPath = path.join(rootDir, '.repomix_config_debug.json'); fs.writeFileSync(dbgPath, JSON.stringify(mergedConfig, null, 2), 'utf8'); logger?.(`Wrote mergedConfig debug file: ${dbgPath}`); } catch (werr) { logger?.(`Failed to write mergedConfig debug file: ${String((werr as any)?.message || werr)}`); }
      await packFn([rootDir], mergedConfig, (s: any) => { try { logger?.(String(s)); } catch {} });

    } else {
      throw new Error('Repomix API not available');
    }
  } catch (e: any) {
    logger?.(`Repomix run error: ${String(e?.message || e)}`);
    throw e;
  }
  logger?.('Repomix packing done');

  // output already written directly into audit dir

  return outPath;
}


