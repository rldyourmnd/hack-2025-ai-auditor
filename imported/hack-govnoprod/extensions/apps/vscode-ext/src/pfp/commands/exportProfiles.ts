import * as vscode from 'vscode';
import * as path from 'path';
import { scanWorkspace } from '../indexer';
import { fastLexFromPath } from '../fastLex';
import { detectStyleFromPath } from '../detectors/styleDetectors';
import { detectPathRole } from '../detectors/roleDetectors';
import { quantizeLexicalCounts } from '../counters';
import { simhash64FromString, pathhash24FromPath, crc8 } from '../fingerprints';
import { packProfile } from '../packer';
import { appendProfile, ensureStore } from '../profilesStore';
import { getPfpConfig } from '../config/settings';

export async function exportProfilesCommand(context: vscode.ExtensionContext) {
  const cfg = getPfpConfig();
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) { vscode.window.showInformationMessage('Open a workspace folder first.'); return; }

  const files = await scanWorkspace(cfg.include, cfg.exclude, { excludeVirtualEnv: cfg.enableLocalPreview !== false && cfg.policyFile === '', excludeSitePackages: cfg.enableLocalPreview !== false });
  const { file } = await ensureStore(wsRoot);
  vscode.window.showInformationMessage(`PFP Export: profiling ${files.length} files; writing to ${file}`);

  for (const f of files) {
    try {
      const abs = path.join(wsRoot, f.path);
      const lex = await fastLexFromPath(abs);
      const style = await detectStyleFromPath(abs);
      const role = await detectPathRole(abs);
      const q = quantizeLexicalCounts({ imports: lex.imports, classes: 0, funcs: lex.funcs, asyncFuncs: lex.asyncFuncs, tryBlocks: lex.tryBlocks, exceptBlocks: lex.exceptBlocks, logCalls: lex.logCalls, printCalls: lex.printCalls, httpCalls: lex.httpCalls, yamlUnsafe: lex.yamlUnsafe, lines: f.size, cyclomatic: 0 });

      const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
      const content = Buffer.from(raw).toString('utf8');
      const sim = simhash64FromString(content);
      const ph = pathhash24FromPath(f.path);
      const provisionalBuf = Buffer.from(content, 'utf8');
      const c8 = crc8(provisionalBuf);

      const corePlanes = [0n, 0n, 0n, 0n];
      const hpcMask = 0n; // compute later with hpc module
      const qBuckets = Object.values(q).map((v: any) => Number(v)) as number[];
      const enums = [] as number[];

      const pfp = packProfile({ schema_id: 0x023, flags: 0, tier: cfg.tier === 'compact' ? 0 : cfg.tier === 'standard' ? 1 : 2, corePlanes, extendedPlanes: [], hpcMask, qBuckets, enums, simhash: sim, pathhash24: ph, crc: c8 });

      // validate generated pfp contains only Ascii85 printable chars after prefix
      const isValidPfp = (s: any) => typeof s === 'string' && s.startsWith('pfp2:') && /^[\x21-\x75]+$/.test(s.slice(5));
      let finalPfp: string | null = pfp;
      if (!isValidPfp(pfp)) {
        console.warn(`Generated invalid pfp for ${f.path}; saving null pfp`);
        finalPfp = null;
      }

      const record = { path: f.path, sha: f.sha, size: f.size, ts: new Date().toISOString(), tier: cfg.tier, pfp: finalPfp, decode_hint: { schema: 'v2.3', flags: 0, planes_present: ['C0','C1','C2','C3','E0','HPC','Q','ENUMS','ID'] } };
      await appendProfile(wsRoot, record);
    } catch (e: any) {
      // non-fatal
      console.warn('PFP export failed for', f.path, e?.message || e);
    }
  }
  vscode.window.showInformationMessage('PFP Export completed.');
}

export default exportProfilesCommand;


