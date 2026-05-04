import * as vscode from 'vscode';
import * as path from 'path';
import { fastLexFromPath } from '../fastLex';
import { detectPathRole } from '../detectors/roleDetectors';
import { simhash64FromString, pathhash24FromPath } from '../fingerprints';
import { computeHpc, hpcToBinaryString } from '../hpc';

export async function compareSelectionCommand(context: vscode.ExtensionContext) {
  const uris = await vscode.window.showOpenDialog({ canSelectMany: true, openLabel: 'Select two files to compare', filters: { 'Python': ['py'] } });
  if (!uris || uris.length < 2) { vscode.window.showInformationMessage('Select two Python files to compare.'); return; }
  const [a, b] = uris;
  const aPath = a.fsPath; const bPath = b.fsPath;
  try {
    const aLex = await fastLexFromPath(aPath);
    const bLex = await fastLexFromPath(bPath);
    const aRole = await detectPathRole(aPath);
    const bRole = await detectPathRole(bPath);
    const aContent = (await vscode.workspace.fs.readFile(a)).toString();
    const bContent = (await vscode.workspace.fs.readFile(b)).toString();
    const aSim = simhash64FromString(aContent);
    const bSim = simhash64FromString(bContent);
    const aPh = pathhash24FromPath(path.relative(vscode.workspace.rootPath || '', aPath));
    const bPh = pathhash24FromPath(path.relative(vscode.workspace.rootPath || '', bPath));

    const aHpc = computeHpc({ asyncio: !!aContent.match(/\basync\b/), http_calls_present: !!aContent.match(/\brequests\.|\bhttpx\./) });
    const bHpc = computeHpc({ asyncio: !!bContent.match(/\basync\b/), http_calls_present: !!bContent.match(/\brequests\.|\bhttpx\./) });

    const md = [] as string[];
    md.push(`# PFP Compare: ${path.basename(aPath)} ↔ ${path.basename(bPath)}`);
    md.push('');
    md.push('## Roles');
    md.push(`- A: ${JSON.stringify(aRole.roleTags||[])} main_guard=${!!aRole.main_guard}`);
    md.push(`- B: ${JSON.stringify(bRole.roleTags||[])} main_guard=${!!bRole.main_guard}`);
    md.push('');
    md.push('## Lexical counts (sample)');
    md.push('|metric|A|B|diff|');
    md.push('|---:|---:|---:|---:|');
    const metrics = ['imports','funcs','asyncFuncs','tryBlocks','exceptBlocks','printCalls','logCalls','httpCalls'];
    for (const m of metrics) {
      const av = (aLex as any)[m]||0; const bv = (bLex as any)[m]||0; md.push(`|${m}|${av}|${bv}|${av-bv}|`);
    }
    md.push('');
    md.push('## Fingerprints');
    md.push(`- simhash A: 0x${aSim.toString(16)} B: 0x${bSim.toString(16)}`);
    md.push(`- pathhash A: 0x${aPh.toString(16)} B: 0x${bPh.toString(16)}`);
    md.push('');
    md.push('## HPC');
    md.push(`- A: ${hpcToBinaryString(aHpc)} (${aHpc.toString(16)})`);
    md.push(`- B: ${hpcToBinaryString(bHpc)} (${bHpc.toString(16)})`);

    const doc = await vscode.workspace.openTextDocument({ content: md.join('\n'), language: 'markdown' });
    await vscode.window.showTextDocument(doc, { preview: false });
  } catch (e: any) {
    vscode.window.showErrorMessage(`Compare failed: ${e?.message || e}`);
  }
}

export default compareSelectionCommand;


