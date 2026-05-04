import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { getAuditDirForWorkspace, pickWorkspaceRoot } from '../utils/audit';

export async function simulateZipLegacyCommand(out: vscode.OutputChannel) {
  try {
    const n = Math.max(1, Number(await vscode.window.showInputBox({ prompt: 'Number of archives to create', value: '1' }) || '1'));
    const ws = await pickWorkspaceRoot();
    if (!ws) return;
    const root = ws.fsPath;
    const auditDir = getAuditDirForWorkspace(root);
    const io = require('../../../packages/io/src');
    for (let i = 0; i < n; i++) {
      const tmp = await io.makeTempDir('ai-auditor-');
      const profiles = path.join(tmp, 'profiles.ndjson.gz');
      const findings = path.join(tmp, 'findings.ndjson.gz');
      const profileFiles = await io.globMany(["**/*profiles*.json*", ".pfp/profiles.jsonl"], root);
      const findingFiles = await io.globMany(["**/findings*.json*"], root);
      await io.toNdjsonGz(profileFiles, profiles, [], (m:string)=>out.appendLine(m));
      await io.toNdjsonGz(findingFiles, findings, [], (m:string)=>out.appendLine(m));
      const manifest = { version: '1.0', generated_at: new Date().toISOString(), repo: { root }, counts: { profiles_lines: 0, findings_lines: 0 } } as any;
      const manifestPath = path.join(tmp, 'manifest.json');
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      const zipPath = path.join(auditDir, `entropy-input-v1-sim-${Date.now()}-${i}.zip`);
      await io.zipFiles(zipPath, [ { name: 'profiles.ndjson.gz', path: profiles }, { name: 'findings.ndjson.gz', path: findings }, { name: 'manifest.json', path: manifestPath } ]);
      out.appendLine(`Simulated archive created: ${zipPath}`);
      vscode.window.showInformationMessage(`Simulated archive created: ${zipPath}`);
    }
  } catch (e:any) { out.appendLine(`simulateUploadArchive failed: ${e?.message||e}`); vscode.window.showErrorMessage(`simulateUploadArchive failed: ${e?.message||e}`); }
}

export async function simulateNzipCommand(out: vscode.OutputChannel) {
  try {
    const n = Math.max(1, Number(await vscode.window.showInputBox({ prompt: 'Number of archives to create (.nzip)', value: '1' }) || '1'));
    const ws = await pickWorkspaceRoot();
    if (!ws) return;
    const root = ws.fsPath;
    const auditDir = getAuditDirForWorkspace(root);

    const yazl = require('yazl');
    const fg = require('fast-glob');

    async function gather(patterns: string[], cwd: string): Promise<string[]> {
      try { return await fg(patterns, { cwd, dot: true, onlyFiles: true, absolute: true, ignore: ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'] }); } catch { return []; }
    }

    async function toNdjsonGz(files: string[], outPath: string, dropFields: string[] = []): Promise<number> {
      let lines = 0;
      await new Promise<void>(async (resolve, reject) => {
        try {
          const ws = fs.createWriteStream(outPath);
          const gz = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
          gz.pipe(ws);
          for (const f of files) {
            try {
              const txt = await fs.promises.readFile(f, 'utf8');
              const lower = f.toLowerCase();
              if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
                for (const line of txt.split(/\r?\n/)) {
                  const t = line.trim();
                  if (!t) continue;
                  let outLine = t;
                  try {
                    const obj = JSON.parse(t);
                    if (dropFields.length) {
                      const pruned: any = {};
                      for (const k of Object.keys(obj)) if (!dropFields.includes(k)) pruned[k] = (obj as any)[k];
                      outLine = JSON.stringify(pruned);
                    } else {
                      outLine = JSON.stringify(obj);
                    }
                  } catch {}
                  gz.write(outLine + '\n');
                  lines++;
                }
              } else if (lower.endsWith('.json')) {
                try {
                  const parsed = JSON.parse(txt);
                  const arr = Array.isArray(parsed) ? parsed : [parsed];
                  for (const obj of arr) {
                    if (dropFields.length) {
                      const pruned: any = {};
                      for (const k of Object.keys(obj || {})) if (!dropFields.includes(k)) pruned[k] = (obj as any)[k];
                      gz.write(JSON.stringify(pruned) + '\n');
                    } else {
                      gz.write(JSON.stringify(obj) + '\n');
                    }
                    lines++;
                  }
                } catch {
                  gz.write(JSON.stringify({ file: path.basename(f), content: txt.slice(0, 10000) }) + '\n');
                  lines++;
                }
              }
            } catch {}
          }
          gz.end();
          ws.on('finish', () => resolve());
          ws.on('error', (e) => reject(e));
        } catch (e) { reject(e); }
      });
      return lines;
    }

    for (let i = 0; i < n; i++) {
      const profileFiles = await gather(["**/*profiles*.json*", ".pfp/profiles.jsonl"], root);
      const findingFiles = await gather(["**/findings*.json*", "**/*cci*.json*", "**/*report*.json*"], root);

      const tmpBase = path.join(auditDir, `.tmp-nzip-${Date.now()}-${i}`);
      try { fs.mkdirSync(tmpBase, { recursive: true }); } catch {}
      const profilesOut = path.join(tmpBase, 'profiles.ndjson.gz');
      const findingsOut = path.join(tmpBase, 'findings.ndjson.gz');
      const manifestPath = path.join(tmpBase, 'manifest.json');

      const profilesLines = await toNdjsonGz(profileFiles, profilesOut, []);
      const findingsLines = await toNdjsonGz(findingFiles, findingsOut, ['weight','score','cdx','cci','scd','entropy']);
      const manifest = { version: '1.0', generated_at: new Date().toISOString(), repo: { root }, counts: { profiles_lines: profilesLines, findings_lines: findingsLines } } as any;
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      const outZip = path.join(auditDir, `entropy-input-v1-${Date.now()}-${i}.nzip`);
      await new Promise<void>((resolve, reject) => {
        try {
          const zip = new yazl.ZipFile();
          const wsOut = fs.createWriteStream(outZip);
          zip.outputStream.pipe(wsOut).on('close', () => resolve());
          zip.addFile(profilesOut, 'profiles.ndjson.gz');
          zip.addFile(findingsOut, 'findings.ndjson.gz');
          zip.addFile(manifestPath, 'manifest.json');
          zip.end();
        } catch (e) { reject(e); }
      });
      out.appendLine(`Simulated .nzip archive created: ${outZip}`);
      vscode.window.showInformationMessage(`Simulated .nzip archive created: ${outZip}`);
    }
  } catch (e:any) { out.appendLine(`simulateNzip failed: ${e?.message||e}`); vscode.window.showErrorMessage(`simulateNzip failed: ${e?.message||e}`); }
}


