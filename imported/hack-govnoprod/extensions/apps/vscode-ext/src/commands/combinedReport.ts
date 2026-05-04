import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAuditDirForWorkspace, pickWorkspaceRoot } from '../utils/audit';

export async function buildCombinedReportCommand(out: vscode.OutputChannel) {
  try {
    const ws = await pickWorkspaceRoot();
    if (!ws) return;
    const root = ws.fsPath;
    const auditDir = getAuditDirForWorkspace(root);
    out.appendLine(`Building combined report from ${auditDir}`);

    const combined: any = { generated_at: new Date().toISOString(), cci: [], pfp: [], summary: { findings_files: 0, profiles_files: 0 } };

    async function readJsonFileSafe(p: string) {
      try { const txt = await fs.promises.readFile(p, 'utf8'); return JSON.parse(txt); } catch (e:any) { out.appendLine(`Failed parse JSON ${p}: ${e?.message||e}`); return null; }
    }

    async function findNewestMatching(dir: string, regexes: RegExp[]): Promise<string | null> {
      let newestPath: string | null = null;
      let newestMtime = 0;
      async function walk(d: string) {
        const items = await fs.promises.readdir(d, { withFileTypes: true });
        for (const it of items) {
          const p = path.join(d, it.name);
          if (it.isDirectory()) await walk(p);
          else if (it.isFile()) {
            for (const rx of regexes) {
              if (rx.test(it.name)) {
                try {
                  const st = await fs.promises.stat(p);
                  if (!newestPath || st.mtimeMs > newestMtime) { newestPath = p; newestMtime = st.mtimeMs; }
                } catch (e:any) { out.appendLine(`stat failed for ${p}: ${String(e?.message||e)}`); }
                break;
              }
            }
          }
        }
      }
      if (fs.existsSync(dir)) await walk(dir);
      return newestPath;
    }

    // CCI/findings/report JSON from auditDir with fast-glob fallback
    try {
      const cciRegexes = [/cci.*\.json$/i, /findings.*\.json$/i, /report.*\.json$/i];
      let newestCci = await findNewestMatching(auditDir, cciRegexes);
      if (!newestCci) {
        try {
          const fg = require('fast-glob');
          const candidates = await fg([`${auditDir.replace(/\\/g,'/')}/**/*{cci,findings,report}*.json`], { dot: true, onlyFiles: true });
          if (candidates && candidates.length) {
            candidates.sort((a: string, b: string) => {
              try { return (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0); } catch { return 0; }
            });
            newestCci = candidates[0];
          }
        } catch (e:any) { out.appendLine(`fast-glob fallback failed for CCI: ${String(e?.message||e)}`); }
      }
      if (newestCci) {
        const j = await readJsonFileSafe(newestCci);
        if (j) {
          const rel = path.relative(auditDir, newestCci);
          const stats = (() => { try { return fs.statSync(newestCci); } catch { return null; } })();
          const findingsCount = Array.isArray(j?.findings) ? j.findings.length : (Array.isArray(j) ? j.length : 0);
          combined.cci.push({ file: rel, size: stats?.size || 0, mtime: stats ? new Date(stats.mtimeMs).toISOString() : null, findingsCount, content: j });
          combined.summary.findings_files += 1;
          out.appendLine(`Using newest CCI report: ${newestCci}`);
        }
      } else {
        out.appendLine('No CCI/findings report found in audit dir');
      }
    } catch (e:any) { out.appendLine(`CCI gather failed: ${e?.message||e}`); }

    // PFP profiles file (configured path preferred, otherwise search workspace)
    try {
      const cfg = vscode.workspace.getConfiguration();
      const pfpPathCfg = cfg.get<string>('aiAuditorPfp.export.path', '.pfp/profiles.jsonl') || '.pfp/profiles.jsonl';
      const absConfigured = path.isAbsolute(pfpPathCfg) ? pfpPathCfg : path.join(root, pfpPathCfg);
      let chosenPfp: string | null = null;
      if (fs.existsSync(absConfigured)) chosenPfp = absConfigured;
      else {
        let found: string | null = null;
        try {
          const fg = require('fast-glob');
          const candidates: string[] = await fg(['**/*profiles*.json*', '**/*profiles*.jsonl*', '**/*profiles*.ndjson*'], { cwd: root, dot: true, onlyFiles: true, absolute: true, ignore: ['**/node_modules/**','**/.git/**','**/dist/**','**/build/**'] });
          if (candidates && candidates.length) {
            candidates.sort((a, b) => {
              try { return (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0); } catch { return 0; }
            });
            found = candidates[0];
          }
        } catch (e:any) { out.appendLine(`fast-glob fallback failed for PFP: ${String(e?.message||e)}`); }
        if (found) chosenPfp = found;
      }

      if (chosenPfp && fs.existsSync(chosenPfp)) {
        const rs = fs.createReadStream(chosenPfp, { encoding: 'utf8' });
        let carry = '';
        let lines = 0;
        const sample: any[] = [];
        for await (const chunk of rs as any) {
          carry += chunk;
          let idx;
          while ((idx = carry.indexOf('\n')) >= 0) {
            const line = carry.slice(0, idx);
            carry = carry.slice(idx + 1);
            if (!line.trim()) continue;
            lines++;
            if (sample.length < 10) {
              try { sample.push(JSON.parse(line)); } catch { sample.push(line); }
            }
          }
        }
        if (carry.trim()) { lines++; try { if (sample.length < 10) sample.push(JSON.parse(carry)); } catch { if (sample.length < 10) sample.push(carry); } }
        const stats = (() => { try { return fs.statSync(chosenPfp); } catch { return null; } })();
        combined.pfp.push({ path: path.relative(root, chosenPfp), size: stats?.size || 0, mtime: stats ? new Date(stats.mtimeMs).toISOString() : null, lines, sample });
        combined.summary.profiles_files += 1;
        out.appendLine(`Using newest PFP profiles: ${chosenPfp}`);
      } else {
        out.appendLine('No PFP profiles file found');
      }

    } catch (e:any) { out.appendLine(`PFP gather failed: ${e?.message||e}`); }

    const outPath = path.join(auditDir, 'combined-report.json');
    await fs.promises.writeFile(outPath, JSON.stringify(combined, null, 2), 'utf8');
    out.appendLine(`Combined report written: ${outPath}`);
    vscode.window.showInformationMessage(`Combined report created: ${outPath}`);
  } catch (e:any) {
    out.appendLine(`Build combined report failed: ${e?.message || e}`);
    vscode.window.showErrorMessage(`Build combined report failed: ${e?.message || e}`);
  }
}


