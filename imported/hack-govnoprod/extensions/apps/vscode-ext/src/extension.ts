import * as vscode from 'vscode';
import { HelperManager } from './helperManager';
import { OverlayController } from './overlay';
import { grabNow } from './revizor/grabOrchestrator';
import { PreviewPanel } from './revizor/previewPanel';
import { DiagnosticsPanel } from './revizor/diagnosticsPanel';
import { applySimPasteFromClipboard, applySimSend } from './revizor/simCopy';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFile, exec } from 'child_process';
import { packWithRepomix, type RepomixStyle } from './pack/repomix';
import { packShotgun } from './pack/shotgun';
import * as zlib from 'zlib';
import { getAuditDirForWorkspace, pickWorkspaceRoot, withStatus } from './utils/audit';
import { buildCombinedReportCommand } from './commands/combinedReport';
import { InstallPanel } from './ui/installPanel';
import { fullInstallFlow } from './install/installer';
import { simulateZipLegacyCommand, simulateNzipCommand } from './commands/simulateArchives';

// kept for future direct server calls via SDK
async function getClient() { return {}; }

// Calculate CCI (Code Consistency Intelligence) score based on findings
function calculateCCI(findings: any[], fileStats: any[]): { cci: number; cdx: number; total_weight: number } {
  if (!findings || findings.length === 0) {
    return { cci: 100, cdx: 0, total_weight: 0 };
  }

  // Calculate total lines of code
  const totalLOC = fileStats.reduce((sum, file) => sum + (file.nonBlankLines || 0), 0);
  if (totalLOC === 0) {
    return { cci: 100, cdx: 0, total_weight: 0 };
  }

  // Weight different finding types based on severity
  const findingWeights: Record<string, number> = {
    // Critical security findings
    'secret_hardcoded': 10,
    'possible_secret': 8,
    'db_raw_in_api': 8,
    
    // High impact code quality issues
    'blocking_call_in_async': 7,
    'cyclomatic_complexity': 6,
    'code_smell_function_length': 5,
    'code_smell_many_params': 4,
    'large_file': 4,
    
    // Medium impact consistency issues
    'db_naming_mismatch': 3,
    'datetime_tz_mismatch': 3,
    'mapping_divergence': 3,
    'id_type_divergence': 3,
    'error_format_divergence': 3,
    'missing_correlation_id': 2,
    'retry_divergence': 2,
    
    // Low impact structural issues
    'pluralization_divergence': 1,
    'import_map': 1,
    'repo_import_graph': 1,
    'import': 0.5, // Very common, low weight
    'from': 0.1,   // Very common, minimal weight
    
    // Default weight for unknown findings
    'default': 2
  };

  // Calculate weighted score
  let totalWeight = 0;
  const findingCounts: Record<string, number> = {};
  
  for (const finding of findings) {
    const kind = finding.kind || 'unknown';
    findingCounts[kind] = (findingCounts[kind] || 0) + 1;
    const weight = findingWeights[kind] || findingWeights['default'];
    totalWeight += weight;
  }

  // Calculate CDX (Code Defect Index) - findings per KLOC
  const cdx = (findings.length / Math.max(totalLOC / 1000, 0.1));

  // Calculate CCI score (0-100, where 100 is perfect)
  // Base score is 100, deduct points based on weighted findings density
  const findingsDensity = totalWeight / Math.max(totalLOC / 1000, 0.1); // weighted findings per KLOC
  
  let cci = 100;
  
  // Deduct points based on findings density (more balanced approach)
  if (findingsDensity > 0) {
    // Use logarithmic scaling to avoid too harsh penalties
    cci = Math.max(0, 100 - (Math.log(1 + findingsDensity) * 25)); // Logarithmic penalty
  }
  
  // Additional penalty for critical issues (more balanced)
  const criticalFindings = findings.filter(f => 
    ['secret_hardcoded', 'possible_secret', 'db_raw_in_api', 'blocking_call_in_async'].includes(f.kind)
  ).length;
  
  if (criticalFindings > 0) {
    // Cap critical penalty to avoid going to 0 too easily
    const criticalPenalty = Math.min(30, criticalFindings * 2); // Max 30 points penalty for critical issues
    cci = Math.max(10, cci - criticalPenalty); // Minimum CCI of 10 even with many critical issues
  }

  return {
    cci: Math.round(cci * 100) / 100, // Round to 2 decimal places
    cdx: Math.round(cdx * 100) / 100,
    total_weight: totalWeight
  };
}

export function activate(context: vscode.ExtensionContext) {
  const auditorOutput = vscode.window.createOutputChannel('AI Auditor');
  auditorOutput.appendLine('Extension activated');
  auditorOutput.appendLine(`Extension root: ${context.extensionPath}`);

  // Helper: resolve audit directory from configuration and workspace
  function getAuditDirForWorkspace(workspaceRoot?: string) {
    try {
      const cfg = vscode.workspace.getConfiguration();
      const rel = (cfg.get<string>('audit.directory', '.audit') || '.audit').trim();
      const root = workspaceRoot || (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || process.cwd();
      const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
      try { fs.mkdirSync(abs, { recursive: true }); } catch {}
      return abs;
    } catch (e) { return path.join(process.cwd(), '.audit'); }
  }

  // Ensure .audit exists for the default workspace (create on activation)
  try {
    const defaultAudit = getAuditDirForWorkspace();
    auditorOutput.appendLine(`Audit dir ensured: ${defaultAudit}`);
  } catch (e:any) { auditorOutput.appendLine(`Audit dir creation failed: ${String(e?.message||e)}`); }

  // log uncaught errors to output channel to avoid crashing the extension host
  try {
    process.on('uncaughtException', (err: any) => { try { auditorOutput.appendLine(`UncaughtException: ${err?.stack || err}`); } catch {} });
    process.on('unhandledRejection', (reason: any) => { try { auditorOutput.appendLine(`UnhandledRejection: ${String(reason)}`); } catch {} });
  } catch {}

  // ensure helper logs to the extension output
  const helper = new HelperManager(context, auditorOutput);
  helper.start().catch((e: any) => { auditorOutput.appendLine(`Helper start failed: ${e?.message || e}`); });

  // Poll helper for pushed text and auto-run analyze
  let pollTimer: NodeJS.Timeout | null = null;
  function startPushPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      try {
        const baseUrl = helper.baseUrl;
        if (!baseUrl) return;
        const r = await fetch(`${baseUrl}/latest`, { method: 'GET' });
        if (!r.ok) return;
        const j: any = await r.json();
        const text = String(j?.text || '');
        if (!text) return;
        auditorOutput.appendLine(`Push detected: ${Math.min(text.length,100)} chars`);
        // analyze immediately and paste/send
        const dlp = await runDlpCliIfEnabled(text);
        const analysis = await analyzeText(dlp.text);
        const revised = analysis.revisedText;
        await vscode.env.clipboard.writeText(revised);
        try { await applySimPasteFromClipboard(); } catch {}
      } catch {}
    }, 600);
  }
  startPushPolling();
  // AHK: quick command to run full install flow (headless)
  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.ahkInstall', async () => {
    try {
      const res = await fullInstallFlow(context, auditorOutput);
      if (res) vscode.window.showInformationMessage(`AHK installed/launched. Exe: ${res.ahkPath}`);
      else vscode.window.showWarningMessage('AHK install failed or cancelled. Open AHK Setup panel for manual steps.');
    } catch (e:any) {
      vscode.window.showErrorMessage(`AHK install error: ${String(e?.message||e)}`);
    }
  }));

  // AHK: forget saved path
  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.ahkForgetPath', async () => {
    try {
      const mod = require('./install/installer');
      mod.clearSavedAhkPath(context);
      vscode.window.showInformationMessage('Saved AutoHotkey path cleared');
    } catch (e:any) {
      vscode.window.showErrorMessage(`Failed to clear saved AHK path: ${String(e?.message||e)}`);
    }
  }));

  // AHK: UI panel for install/controls
  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.ahkInstallPanel', async () => {
    const panel = new InstallPanel(context, auditorOutput);
    panel.show();
  }));

  // C6: status bar, cancellation, notifications
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = 'Auditor';
  statusBarItem.tooltip = 'AI Auditor — click to open findings';
  statusBarItem.command = 'aiAuditor.analyze';
  statusBarItem.show();
  let currentAnalysisCancellation: vscode.CancellationTokenSource | null = null;

  function notify(level: 'info'|'warn'|'error', message: string) {
    const mode = vscode.workspace.getConfiguration().get<string>('auditor.ui.notifications', 'all');
    if (mode === 'errorsOnly' && level !== 'error') return;
    if (mode === 'warnings' && level === 'info') return;
    if (level === 'info') vscode.window.showInformationMessage(message);
    if (level === 'warn') vscode.window.showWarningMessage(message);
    if (level === 'error') vscode.window.showErrorMessage(message);
  }

  function setStatusIdle() {
    const minimal = vscode.workspace.getConfiguration().get<boolean>('auditor.ui.statusBarMinimal', false);
    statusBarItem.text = minimal ? 'Auditor' : 'Auditor: Idle';
    statusBarItem.color = undefined;
  }

  function setStatusRunning(promptCount?: number, docCount?: number) {
    const minimal = vscode.workspace.getConfiguration().get<boolean>('auditor.ui.statusBarMinimal', false);
    const p = promptCount ?? 0;
    const d = docCount ?? 0;
    statusBarItem.text = minimal ? `Auditor: ${p}/${d}` : `Auditor: Analyzing ${p} prompts + ${d} docs...`;
    statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
  }

  function setStatusDone(findings = 0) {
    const minimal = vscode.workspace.getConfiguration().get<boolean>('auditor.ui.statusBarMinimal', false);
    statusBarItem.text = minimal ? `Auditor: ${findings}` : `Auditor: Done — ${findings} findings`;
    statusBarItem.color = findings > 0 ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
  }

  const overlay = new OverlayController(() => vscode.commands.executeCommand('aiAuditor.analyze'));
  try { overlay.show(); } catch (e: any) { auditorOutput.appendLine(`Overlay show failed: ${e?.message || e}`); }
  context.subscriptions.push({ dispose: () => overlay.dispose() });

  // Some activation orders (packaged) may hide status bar items briefly — ensure they are shown again shortly after activation
  setTimeout(() => {
    try { overlay.show(); auditorOutput.appendLine('Overlay re-show executed'); } catch (e: any) { auditorOutput.appendLine(`Overlay re-show failed: ${e?.message || e}`); }
  }, 500);

  // create PFP status bar item (scoped)
  try {
    const { createPfpStatusBar } = require('./pfp/ui/statusBar');
    const pfpBar: any = createPfpStatusBar();
    context.subscriptions.push(pfpBar);
  } catch (e: any) {
    auditorOutput.appendLine(`PFP statusBar failed to create: ${e?.message || e}`);
  }

  // Settings panel: removed in favor of using extension configuration UI

  const disposable = vscode.commands.registerCommand('aiAuditor.analyze', async () => {
    const editor = vscode.window.activeTextEditor;
    const text = editor?.document.getText(editor.selection.isEmpty ? undefined : editor.selection) || '';
    try {
      // Call helper mock to get revised suggestion
      const baseUrl = helper.baseUrl;
      let revised = text;
      if (baseUrl) {
        const r = await fetch(`${baseUrl}/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
        if (r.ok) {
          const j: any = await r.json(); revised = j.revised ?? text;
        }
      }
      const confirm = await vscode.window.showInformationMessage('Replace chat input with analyzed text?', 'Replace', 'Cancel');
      if (confirm === 'Replace' && editor) {
        await editor.edit((eb) => eb.replace(editor.selection.isEmpty ? new vscode.Range(0, 0, editor.document.lineCount, 0) : editor.selection, revised));
      }
    } catch (e: any) {
      vscode.window.showErrorMessage(`AI Auditor error: ${e?.message || e}`);
    }
  });
  context.subscriptions.push(disposable);

  // Token management commands
  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.setUploadToken', async () => {
    const token = await vscode.window.showInputBox({ prompt: 'Enter upload token (stored in SecretStorage)', ignoreFocusOut: true, password: true });
    if (!token) return vscode.window.showInformationMessage('Token not set');
    await context.secrets.store('ai-auditor.upload.token', token);
    vscode.window.showInformationMessage('Upload token stored in SecretStorage');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.clearUploadToken', async () => {
    await context.secrets.delete('ai-auditor.upload.token');
    vscode.window.showInformationMessage('Upload token removed from SecretStorage');
  }));

  // ai-auditor command registrations follow (implemented below)

  // === Repo Digest Commands ===

  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.repoStructureV2', async () => {
    try {
      auditorOutput.appendLine('Command invoked: ai-auditor.pack.repomix');
      const root = await pickWorkspaceRoot();
      if (!root) return;
      const cfg = vscode.workspace.getConfiguration();
      const style = (cfg.get<string>('ai-auditor.repomix.style', 'xml') as RepomixStyle);
      const compress = cfg.get<boolean>('ai-auditor.repomix.compress', true);
      const outPath = await withStatus('Repomix: packing…', async (token) => {
        auditorOutput.appendLine('Repomix: started');
        const auditDir = getAuditDirForWorkspace(root.fsPath);
        const out = await packWithRepomix(root.fsPath, style, !!compress, (m) => auditorOutput.appendLine(m), token, context.extensionPath, auditDir);
        auditorOutput.appendLine('Repomix: finished');
        return out;
      });
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage(`Repo structure output created: ${outPath}`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`Repomix pack failed: ${e?.message || String(e)}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.repoStructureV1', async () => {
    try {
      auditorOutput.appendLine('Command invoked: ai-auditor.pack.shotgun');
      const root = await pickWorkspaceRoot();
      if (!root) return;
      const cfg = vscode.workspace.getConfiguration();
      const maxFiles = Math.max(1, Number(cfg.get<number>('ai-auditor.maxFiles', 1200)) || 1200);
      const maxFileKB = Math.max(1, Number(cfg.get<number>('ai-auditor.maxFileKB', 50)) || 50);
      const include = (cfg.get<string[]>('ai-auditor.include', ['**/*']) || ['**/*']);
      const exclude = (cfg.get<string[]>('ai-auditor.exclude', []) || []);
      const outPath = await withStatus('Shotgun: packing…', async (token) => {
        auditorOutput.appendLine('Shotgun: started');
        const auditDir = getAuditDirForWorkspace(root.fsPath);
        const out = await packShotgun(root.fsPath, { include, exclude, maxFiles, maxFileKB }, (m) => auditorOutput.appendLine(m), token, context.extensionPath, auditDir);
        auditorOutput.appendLine('Shotgun: finished');
        return out;
      });
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
      await vscode.window.showTextDocument(doc, { preview: false });
      vscode.window.showInformationMessage(`Repo structure created: ${outPath}`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`Shotgun pack failed: ${e?.message || String(e)}`);
    }
  }));

  // Debug helper command removed (dev-only). Use Output channel and helper logs for health checks.

  // Revizor commands
  const preview = new PreviewPanel(context);
  const diag = new DiagnosticsPanel(context);
  // load FindingsPanel defensively — if require fails, use a no-op stub so extension still runs
  let findingsPanel: any;
  try {
    // prefer static import when possible; fallback to require for packed vs dev modes
    const mod = require('./revizor/findingsPanel');
    findingsPanel = new (mod.FindingsPanel)(context);
  } catch (e: any) {
    auditorOutput.appendLine(`FindingsPanel failed to load: ${e?.message || e}`);
    findingsPanel = { show: (_: any) => { vscode.window.showInformationMessage('Findings UI unavailable (see Output).'); } };
  }
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('auditor');
  context.subscriptions.push(diagnosticCollection);
  const findingsByFile = new Map<string, any[]>();
  let lastGrab: { result: any, revised: string } | null = null;

  // DLP CLI: optional local sanitizer step before analysis
  async function runDlpCliIfEnabled(inputText: string): Promise<{ ok: boolean; text: string; blocked: boolean; message?: string }> {
    try {
      const cfg = vscode.workspace.getConfiguration();
      const enabled = cfg.get<boolean>('dlpCli.enabled', false);
      if (!enabled) return { ok: true, text: inputText, blocked: false };
      const exePath = (cfg.get<string>('dlpCli.path', '') || '').trim();
      const timeoutMs = Math.max(1000, Math.min(60000, Number(cfg.get<number>('dlpCli.timeoutMs', 6000) || 6000)));
      if (!exePath) {
        auditorOutput.appendLine('DLP CLI enabled but no path configured. Skipping.');
        return { ok: true, text: inputText, blocked: false, message: 'DLP path not set' };
      }
      try {
        const exists = fs.existsSync(exePath);
        if (!exists) {
          auditorOutput.appendLine(`DLP path does not exist: ${exePath}`);
          return { ok: true, text: inputText, blocked: false, message: 'DLP path missing' };
        }
      } catch {}
      const nonce = crypto.randomBytes(6).toString('hex');
      const inFile = path.join(os.tmpdir(), `revizor_in_${nonce}.txt`);
      const outFile = path.join(os.tmpdir(), `revizor_out_${nonce}.txt`);
      try { await fs.promises.unlink(inFile).catch(() => {}); await fs.promises.unlink(outFile).catch(() => {}); } catch {}
      await fs.promises.writeFile(inFile, inputText, { encoding: 'utf8' });

      const execOk = await new Promise<{ code: number }>((resolve) => {
        try {
          const isWin = process.platform === 'win32';
          const isBat = /\.(bat|cmd)$/i.test(exePath);
          if (isWin && isBat) {
            const cmdStr = `"${exePath}" scan --in "${inFile}" --out "${outFile}"`;
            auditorOutput.appendLine(`DLP exec (shell): ${cmdStr}`);
            const child = exec(cmdStr, { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
              try { if (stdout && String(stdout).trim()) auditorOutput.appendLine(`DLP stdout: ${String(stdout).trim().substring(0,2000)}`); } catch {}
              try { if (stderr && String(stderr).trim()) auditorOutput.appendLine(`DLP stderr: ${String(stderr).trim().substring(0,2000)}`); } catch {}
              if (err) {
                auditorOutput.appendLine(`DLP exec error: ${String((err as any).message || err)} code=${(err as any)?.code}`);
                const code = (err as any)?.code;
                resolve({ code: typeof code === 'number' ? code : -1 });
              } else {
                resolve({ code: 0 });
              }
            });
            child.on('error', (e) => { auditorOutput.appendLine(`DLP child error: ${String(e?.message || e)}`); resolve({ code: -1 }); });
          } else {
            auditorOutput.appendLine(`DLP execFile: ${exePath} scan --in ${inFile} --out ${outFile}`);
            const child = execFile(exePath, ['scan', '--in', inFile, '--out', outFile], { windowsHide: true, timeout: timeoutMs }, (err, stdout, stderr) => {
              try { if (stdout && String(stdout).trim()) auditorOutput.appendLine(`DLP stdout: ${String(stdout).trim().substring(0,2000)}`); } catch {}
              try { if (stderr && String(stderr).trim()) auditorOutput.appendLine(`DLP stderr: ${String(stderr).trim().substring(0,2000)}`); } catch {}
              if (err) {
                auditorOutput.appendLine(`DLP execFile error: ${String((err as any).message || err)} code=${(err as any)?.code}`);
                const code = (err as any)?.code;
                resolve({ code: typeof code === 'number' ? code : -1 });
              } else {
                resolve({ code: 0 });
              }
            });
            child.on('error', (e) => { auditorOutput.appendLine(`DLP child error: ${String(e?.message || e)}`); resolve({ code: -1 }); });
          }
        } catch (e) {
          auditorOutput.appendLine(`DLP spawn failed: ${String((e as any)?.message || e)}`);
          resolve({ code: -1 });
        }
      });

      if (execOk.code !== 0) {
        auditorOutput.appendLine(`DLP CLI blocked or failed with exit ${execOk.code}`);
        try { await fs.promises.unlink(inFile).catch(() => {}); await fs.promises.unlink(outFile).catch(() => {}); } catch {}
        // Non-zero exit means blocked by policy
        return { ok: false, text: inputText, blocked: true, message: `DLP blocked (exit ${execOk.code})` };
      }

      let cleaned = '';
      try { cleaned = await fs.promises.readFile(outFile, 'utf8'); } catch {}
      try { await fs.promises.unlink(inFile).catch(() => {}); await fs.promises.unlink(outFile).catch(() => {}); } catch {}
      if (!cleaned) cleaned = inputText;
      return { ok: true, text: cleaned, blocked: false };
    } catch (e: any) {
      return { ok: true, text: inputText, blocked: false, message: e?.message || String(e) };
    }
  }

  // Analyze text using helper server or fallback to local heuristics
  async function analyzeText(text: string): Promise<{ revisedText: string; findings: Array<{ kind: string; message: string }> }> {
    // Try helper server first
    const baseUrl = helper.baseUrl;
    if (baseUrl) {
      try {
        auditorOutput.appendLine(`Analyzing text via helper server: ${baseUrl}/analyze`);
        const response = await fetch(`${baseUrl}/analyze`, { 
          method: 'POST', 
          headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ text }) 
        });
        
        if (response.ok) {
          const result: any = await response.json();
          auditorOutput.appendLine(`Helper server analysis successful. Findings: ${result.findings?.length || 0}`);
          return { 
            revisedText: result.revised || text.replace(/\s+$/gm, '').trim(),
            findings: (result.findings || []).map((f: any) => ({ 
              kind: String(f.kind || 'finding'), 
              message: String(f.message || '') 
            }))
          };
        } else {
          auditorOutput.appendLine(`Helper server error: ${response.status} ${response.statusText}`);
        }
      } catch (e: any) {
        auditorOutput.appendLine(`Helper server fetch failed: ${e?.message || e}`);
      }
    } else {
      auditorOutput.appendLine('No helper server available for analysis');
    }

    // Fallback: simple local heuristics
    auditorOutput.appendLine('Using fallback local analysis');
    const findings = [] as Array<{ kind: string; message: string }>;
    if (text.length > 4000) findings.push({ kind: 'length', message: 'Text is quite long; consider shortening.' });
    if (/password|api[_\- ]?key/i.test(text)) findings.push({ kind: 'pii', message: 'Potential secret-like token detected.' });
    const revisedText = text.replace(/\s+$/gm, '').trim();
    return { revisedText, findings };
  }

  // C5: Revise prompt flow (selection or whole file)
  async function revisePromptCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file or select a prompt section to revise.');
      return;
    }
    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = selection.isEmpty ? doc.getText() : doc.getText(selection);

    const baseUrl = helper.baseUrl;
    if (!baseUrl) {
      vscode.window.showErrorMessage('No helper available to perform revise. Start the helper first.');
      return;
    }

    const source = {
      id: crypto.createHash('sha1').update(doc.uri.toString() + (selection.isEmpty ? '#full' : `#${selection.start.line}-${selection.end.line}`)).digest('hex'),
      fileUri: doc.uri.toString(),
      fileRelPath: vscode.workspace.asRelativePath(doc.uri),
      kind: 'file',
      section: selection.isEmpty ? 'full' : `lines:${selection.start.line}-${selection.end.line}`,
      title: path.basename(doc.uri.fsPath) + (selection.isEmpty ? '' : `#sel`),
      content: selectedText,
      contentHash: crypto.createHash('sha1').update(selectedText).digest('hex')
    };

    try {
      const r = await fetch(`${baseUrl}/revise`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source, context: [] }) });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const j: any = await r.json() as any;
      const patches: any[] = j?.patches ?? (Array.isArray(j) ? j : []);
      if (!Array.isArray(patches) || patches.length === 0) {
        vscode.window.showInformationMessage('No patches suggested.');
        return;
      }

      // present quickpick for patches
      const items = patches.map((p, idx) => ({ label: `[${p.kind}] ${p.title || 'patch #' + (idx+1)}`, description: p.rationale || p.description || '', idx }));
      const picks = await vscode.window.showQuickPick(items, { canPickMany: true, placeHolder: 'Select patches to apply' });
      if (!picks || picks.length === 0) return;

      const toApply = picks.map(p => patches[p.idx]);

      // prepare WorkspaceEdit; to avoid offsets, apply edits per file sorted by start descending
      const editsByFile = new Map<string, Array<{ range: vscode.Range; newText: string }>>();
      for (const patch of toApply) {
        for (const e of patch.edits || []) {
          // expect RangeLC { start:{line,character}, end:{line,character} }
          const r = e.range;
          if (!r || !r.start) continue;
          const range = new vscode.Range(r.start.line, r.start.character, r.end.line, r.end.character);
          const list = editsByFile.get(source.fileUri) || [];
          list.push({ range, newText: e.newText });
          editsByFile.set(source.fileUri, list);
        }
      }

      // check document version
      const docVersion = doc.version;
      const wsEdit = new vscode.WorkspaceEdit();
      for (const [fileUri, edits] of editsByFile) {
        const uri = vscode.Uri.parse(fileUri);
        // sort descending
        edits.sort((a,b) => {
          if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line;
          return b.range.start.character - a.range.start.character;
        });
        for (const it of edits) wsEdit.replace(uri, it.range, it.newText);
      }

      // confirm and apply
      const confirm = await vscode.window.showInformationMessage(`Apply ${Array.from(editsByFile.values()).reduce((s,a)=>s+a.length,0)} edits as one undo?`, 'Apply', 'Cancel');
      if (confirm !== 'Apply') return;

      // re-check doc version
      const currentDoc = await vscode.workspace.openTextDocument(doc.uri);
      if (currentDoc.version !== docVersion) {
        const ok = await vscode.window.showWarningMessage('Document changed since patch generation. Re-run revise or proceed and risk conflicts.', 'Proceed', 'Cancel');
        if (ok !== 'Proceed') return;
      }

      const success = await vscode.workspace.applyEdit(wsEdit);
      if (success) {
        // store last applied for quick rollback
        await context.workspaceState.update('auditor.lastAppliedPatchSet', { file: doc.uri.toString(), patches: toApply, appliedAt: new Date().toISOString() });
        vscode.window.showInformationMessage('Patches applied.');
      } else {
        vscode.window.showErrorMessage('Failed to apply patches.');
      }

    } catch (e: any) {
      auditorOutput.appendLine(`Revise failed: ${e?.message || e}`);
      vscode.window.showErrorMessage(`Revise failed: ${e?.message || e}`);
    }
  }

  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.grabNow', async () => {
    auditorOutput.appendLine('=== Manual Grab Command ===');
    const res = await grabNow();
    auditorOutput.appendLine(`Grab result: ok=${res.ok}, method=${res.method}, textLength=${res.text?.length || 0}`);
    
    // Update overlay status
    overlay.updateGrabStatus(res.ok, res.text?.length || 0);
    
    diag.show(res);
    if (!res.ok || !res.text) {
      const errorMsg = res.message || 'No text captured. Make sure you have text in the Cursor AI input field.';
      auditorOutput.appendLine(`Grab failed: ${errorMsg}`);
      // Show a gentle notification instead of warning
      vscode.window.showInformationMessage(`AI Auditor: ${errorMsg}`);
      return;
    }
    
    // Support @audit prefix to enforce audit flow explicitly
    let grabbedText = res.text;
    if (/^@audit\s/i.test(grabbedText)) grabbedText = grabbedText.replace(/^@audit\s+/i, '');

    // DLP first (if enabled)
    const dlp = await runDlpCliIfEnabled(grabbedText);
    if (dlp.blocked) {
      vscode.window.showWarningMessage('DLP: Sending blocked by policy.');
      return;
    }
    if (dlp.message) auditorOutput.appendLine(`DLP note: ${dlp.message}`);
    auditorOutput.appendLine(`Successfully grabbed: "${dlp.text.substring(0, 100)}${dlp.text.length > 100 ? '...' : ''}"`);
    
    // Analyze the (possibly cleaned) text
    const analysis = await analyzeText(dlp.text);
    const findings = analysis.findings;
    const revised = analysis.revisedText;
    
    lastGrab = { result: res, revised };
    const showPreview = vscode.workspace.getConfiguration().get<boolean>('revizor.ui.showPreview', true);
    
    if (showPreview) {
      auditorOutput.appendLine('Showing preview with analysis results');
      preview.show(res.text, { revisedText: revised, findings }, async (rev) => {
        lastGrab = { result: res, revised: rev };
        await vscode.commands.executeCommand('aiAuditor.applyRevised');
      });
    } else {
      auditorOutput.appendLine('Auto-applying revised text');
      await vscode.commands.executeCommand('aiAuditor.applyRevised');
    }
  }));

  // C4: Analyze workspace for prompt artifacts and docs
  async function analyzeWorkspaceCommand() {
    const wsFolders = vscode.workspace.workspaceFolders ?? [];
    if (wsFolders.length === 0) {
      vscode.window.showInformationMessage('No workspace folder open.');
      return;
    }

    const pick = await vscode.window.showQuickPick([
      { label: 'Current File', id: 'current' },
      { label: 'Selected Folder', id: 'folder' },
      { label: 'Workspace Root(s)', id: 'roots' }
    ], { placeHolder: 'Select scope for prompt analysis' });
    if (!pick) return;

    // load config with defaults
    const cfg = vscode.workspace.getConfiguration();
    const cursorCfg = cfg.get<any>('auditor.cursorPrompt') || {};
    const docsCfg = cfg.get<any>('auditor.docs') || {};

    const searchFolders: string[] = cursorCfg.searchFolders || [
      '.cursor/prompts/', '.cursor/agents/', '.cursor/policies/', 'cursor/prompts/', 'cursor/agents/', 'prompts/', '_prompts/', '.prompts/'
    ];
    const extensions: string[] = cursorCfg.extensions || ['.prompt', '.cprompt', '.txt', '.md'];
    const filenameIncludes: string[] = (cursorCfg.filenameIncludes || ['prompt','system','persona','agent','policy']).map((s: string) => s.toLowerCase());
    const jsonPromptFields: string[] = cursorCfg.jsonPromptFields || ['systemPrompt','userPrompt','prompt','instructions','policy'];
    const excludeGlobs: string[] = cursorCfg.excludeGlobs || [];

    const docsFolders: string[] = docsCfg.searchFolders || ['docs/','documentation/','handbook/','knowledge/','wiki/',''];
    const maxPrompts = 500;
    const maxDocs = 2000;

    // build candidate files
    const promptUris = new Map<string, vscode.Uri>();
    const docUris = new Map<string, vscode.Uri>();

    // helper to normalize path
    const matchInclude = (filePath: string, folders: string[], includes: string[]) => {
      const p = filePath.replace(/\\/g, '/').toLowerCase();
      // folder match
      for (const f of folders) {
        const fn = (f || '').replace(/\\/g,'/').toLowerCase();
        if (!fn || fn === '') return true; // empty means include root
        if (p.includes(`/${fn}`) || p.includes(fn)) return true;
      }
      // filename includes
      const base = path.basename(p);
      for (const inc of includes) if (base.includes(inc)) return true;
      return false;
    };

    // gather files by extension across workspace, then filter by configured folders/includes
    currentAnalysisCancellation?.cancel();
    currentAnalysisCancellation = new vscode.CancellationTokenSource();
    const token = currentAnalysisCancellation.token;
    setStatusRunning();
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Collecting prompt artifacts', cancellable: true }, async (progress, uiToken) => {
      uiToken.onCancellationRequested(() => { currentAnalysisCancellation?.cancel(); });
      let totalFound = 0;
      for (const ws of wsFolders) {
        for (const ext of extensions) {
          if (token.isCancellationRequested) return;
          const pattern = `**/*${ext}`;
          const uris = await vscode.workspace.findFiles(pattern, undefined, 10000);
          for (const u of uris) {
            const p = u.fsPath.replace(/\\/g,'/');
            if (excludeGlobs.some((g: string) => g && p.includes(g))) continue;
            if (!matchInclude(p, searchFolders, filenameIncludes)) continue;
            promptUris.set(u.toString(), u);
            totalFound++;
            if (promptUris.size > maxPrompts) break;
          }
          progress.report({ message: `Found ${promptUris.size} prompt candidates` });
          if (promptUris.size > maxPrompts) break;
        }
        if (promptUris.size > maxPrompts) break;
      }

      // docs (.md)
      for (const ws of wsFolders) {
        if (token.isCancellationRequested) return;
        const uris = await vscode.workspace.findFiles('**/*.md', undefined, 20000);
        for (const u of uris) {
          const p = u.fsPath.replace(/\\/g,'/');
          if (excludeGlobs.some((g: string) => g && p.includes(g))) continue;
          if (!matchInclude(p, docsFolders, [])) continue;
          docUris.set(u.toString(), u);
          if (docUris.size > maxDocs) break;
        }
        progress.report({ message: `Found ${docUris.size} docs` });
        if (docUris.size > maxDocs) break;
      }
    });
    currentAnalysisCancellation = null;
    setStatusIdle();

    if (promptUris.size === 0 && docUris.size === 0) {
      vscode.window.showInformationMessage('No prompt artifacts or docs found with current configuration/scope.');
      return;
    }

    // read contents, extract JSON fields if necessary
    const promptSources: Array<any> = [];
    const docSources: Array<any> = [];

    for (const [k, uri] of promptUris) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(raw).toString('utf8');
        if (uri.fsPath.endsWith('.json')) {
          try {
            const j = JSON.parse(content);
            for (const fld of jsonPromptFields) {
              const v = j?.[fld];
              if (typeof v === 'string' && v.trim()) {
                const id = crypto.createHash('sha1').update(uri.toString() + '::' + fld).digest('hex');
                const ch = crypto.createHash('sha1').update(v).digest('hex');
                promptSources.push({ id, fileUri: uri.toString(), fileRelPath: vscode.workspace.asRelativePath(uri), kind: 'json', section: fld, title: `${path.basename(uri.fsPath)}#${fld}`, content: v, contentHash: ch, tags: [fld] });
              }
            }
          } catch { /* ignore invalid json */ }
        } else {
          const id = crypto.createHash('sha1').update(uri.toString()).digest('hex');
          const ch = crypto.createHash('sha1').update(content).digest('hex');
          promptSources.push({ id, fileUri: uri.toString(), fileRelPath: vscode.workspace.asRelativePath(uri), kind: 'file', title: path.basename(uri.fsPath), content, contentHash: ch, tags: [] });
        }
      } catch (e: any) {
        auditorOutput.appendLine(`Failed read ${uri.toString()}: ${e?.message || e}`);
      }
    }

    for (const [k, uri] of docUris) {
      try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(raw).toString('utf8');
        const id = crypto.createHash('sha1').update(uri.toString()).digest('hex');
        const ch = crypto.createHash('sha1').update(content).digest('hex');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : path.basename(uri.fsPath);
        docSources.push({ id, fileUri: uri.toString(), fileRelPath: vscode.workspace.asRelativePath(uri), title, content, contentHash: ch });
      } catch (e: any) {
        auditorOutput.appendLine(`Failed read doc ${uri.toString()}: ${e?.message || e}`);
      }
    }

    // enforce limits
    if (promptSources.length > maxPrompts) {
      vscode.window.showErrorMessage(`Too many prompt candidates (${promptSources.length}). Narrow scope or increase limits.`);
      return;
    }
    if (docSources.length > maxDocs) {
      vscode.window.showErrorMessage(`Too many docs (${docSources.length}). Narrow scope or increase limits.`);
      return;
    }

    // build manifest
    const manifest = {
      workspaceRoot: wsFolders[0].uri.toString(),
      generatedAt: new Date().toISOString(),
      provider: cfg.get('auditor.provider', 'local'),
      model: cfg.get('auditor.model', 'default'),
      riskThreshold: cfg.get('auditor.riskThreshold', 0.5),
      prompts: promptSources.map((p: any) => ({ id: p.id, fileRelPath: p.fileRelPath, kind: p.kind, section: p.section, contentHash: p.contentHash })),
      docs: docSources.map((d: any) => ({ id: d.id, fileRelPath: d.fileRelPath, contentHash: d.contentHash })),
      stats: { promptCount: promptSources.length, docCount: docSources.length, totalChars: promptSources.reduce((s: number, p: any) => s + (p.content?.length || 0), 0) + docSources.reduce((s: number, d: any) => s + (d.content?.length || 0), 0) }
    };

    // send to helper server if available
    const baseUrl = helper.baseUrl;
    if (!baseUrl) {
      auditorOutput.appendLine('No local helper available — manifest generated but not sent');
      auditorOutput.appendLine(JSON.stringify(manifest, null, 2));
      vscode.window.showInformationMessage(`Collected ${promptSources.length} prompts and ${docSources.length} docs (manifest saved to Auditor output).`);
      return;
    }

    try {
      const send = async (pathSuffix: string, body: any) => {
        const r = await fetch(`${baseUrl}${pathSuffix}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json().catch(() => ({}));
      };
      await send('/analyze/manifest', manifest);
      // send in batches
      const batchSize = 50;
      for (let i = 0; i < promptSources.length; i += batchSize) {
        const batch = promptSources.slice(i, i + batchSize);
        await send('/analyze/prompts', batch);
      }
      for (let i = 0; i < docSources.length; i += 20) {
        const batch = docSources.slice(i, i + 20);
        await send('/analyze/docs', batch);
      }
      await send('/analyze/run', { manifestId: manifest.workspaceRoot });
      vscode.window.showInformationMessage(`Analysis sent: ${promptSources.length} prompts, ${docSources.length} docs.`);
      // try to fetch immediate findings summary if helper provides
      try {
        const summary: any = await fetch(`${baseUrl}/analyze/summary`, { method: 'GET' }).then(r => r.ok ? r.json().catch(() => null) : null) as any;
        const payload = {
          summary: summary?.summary ?? { prompts: promptSources.length, docs: docSources.length, total: 0, bySeverity: {} },
          files: summary?.files ?? []
        };
        findingsPanel.show(payload as any);
        // store findings for later actions
        (payload.files || []).forEach((f: any) => { if (f.fileUri) findingsByFile.set(f.fileUri, f.findings || []); });
        // populate diagnostics
        createDiagnosticsFromFindings(payload);
        setStatusDone(payload.summary.total || 0);
      } catch (err) {
        auditorOutput.appendLine('No immediate findings available.');
      }
    } catch (e: any) {
      auditorOutput.appendLine(`Failed to send analysis: ${e?.message || e}`);
      vscode.window.showErrorMessage(`Failed to send analysis: ${e?.message || e}`);
    }
  }

  function createDiagnosticsFromFindings(payload: any) {
    try {
      diagnosticCollection.clear();
      const entries: Array<[vscode.Uri, vscode.Diagnostic[]]> = [];
      for (const f of (payload.files || [])) {
        const uri = vscode.Uri.parse(f.fileUri);
        const diags: vscode.Diagnostic[] = [];
        for (const fi of (f.findings || [])) {
          if (!fi.range) continue;
          const r = fi.range;
          const range = new vscode.Range(r.start.line, r.start.character, r.end.line, r.end.character);
          const severity = fi.severity === 'error' ? vscode.DiagnosticSeverity.Error : fi.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
          const diag = new vscode.Diagnostic(range, fi.message || String(fi.kind || 'Auditor finding'), severity);
          diag.source = 'Auditor';
          // attach finding object for later lookup via message text
          (diag as any).finding = fi;
          diags.push(diag);
        }
        if (diags.length) entries.push([uri, diags]);
      }
      diagnosticCollection.set(entries);
    } catch (e: any) {
      auditorOutput.appendLine(`Diagnostics build error: ${e?.message || e}`);
    }
  }


  // Analyze & Send commands
  async function runAnalyzeAndMaybeSend(doSend: boolean) {
    auditorOutput.appendLine(`=== Starting ${doSend ? 'Analyze & Send' : 'Analyze'} ===`);
    
    const res = await grabNow();
    auditorOutput.appendLine(`Grab result: ok=${res.ok}, method=${res.method}, textLength=${res.text?.length || 0}, platform=${res.platform}`);
    if (res.message) auditorOutput.appendLine(`Grab message: ${res.message}`);
    
    // Update overlay status
    overlay.updateGrabStatus(res.ok, res.text?.length || 0);
    
    diag.show(res);
    if (!res.ok || !res.text) {
      const errorMsg = res.message || 'No text found in clipboard. Please select and copy text (Ctrl+C) first, then click Grab Cursor.';
      auditorOutput.appendLine(`Grab failed: ${errorMsg}`);
      // Show a gentle notification instead of warning  
      vscode.window.showInformationMessage(`AI Auditor: ${errorMsg}`);
      return;
    }
    
    auditorOutput.appendLine(`Captured text preview: "${res.text.substring(0, 100)}${res.text.length > 100 ? '...' : ''}"`);
    
    // Support @audit prefix
    let grabbedText = res.text;
    if (/^@audit\s/i.test(grabbedText)) grabbedText = grabbedText.replace(/^@audit\s+/i, '');

    // DLP first (if enabled)
    const dlp = await runDlpCliIfEnabled(grabbedText);
    if (dlp.blocked) {
      vscode.window.showWarningMessage('DLP: Sending blocked by policy.');
      return;
    }
    if (dlp.message) auditorOutput.appendLine(`DLP note: ${dlp.message}`);

    const analysis = await analyzeText(dlp.text);
    auditorOutput.appendLine(`Analysis complete: ${analysis.findings.length} findings`);
    
    const revised = analysis.revisedText;
    const showPreview = vscode.workspace.getConfiguration().get<boolean>('revizor.ui.showPreview', true);
    
    if (showPreview) {
      auditorOutput.appendLine('Showing preview panel');
      const findings = analysis.findings.map(f => ({ kind: f.kind, message: f.message }));
      preview.show(res.text, { revisedText: revised, findings }, async (rev) => {
        auditorOutput.appendLine(`Applying revised text: ${rev.length} chars`);
        await vscode.env.clipboard.writeText(rev);
        try {
          await applySimPasteFromClipboard();
          if (doSend) await applySimSend();
          auditorOutput.appendLine(`Successfully ${doSend ? 'pasted and sent' : 'pasted'}`);
          vscode.window.showInformationMessage(`Successfully ${doSend ? 'analyzed and sent' : 'analyzed'} prompt!`);
        } catch (e: any) {
          auditorOutput.appendLine(`Paste/send failed: ${e?.message || e}`);
          vscode.window.showInformationMessage('Revised text copied. Paste (and press Enter) manually.');
        }
      });
      return;
    }
    
    auditorOutput.appendLine('Applying without preview');
    await vscode.env.clipboard.writeText(revised);
    try {
      await applySimPasteFromClipboard();
      if (doSend) await applySimSend();
      auditorOutput.appendLine(`Successfully ${doSend ? 'pasted and sent' : 'pasted'}`);
      vscode.window.showInformationMessage(`Successfully ${doSend ? 'analyzed and sent' : 'analyzed'} prompt!`);
    } catch (e: any) {
      auditorOutput.appendLine(`Paste/send failed: ${e?.message || e}`);
      vscode.window.showInformationMessage('Revised text copied. Paste (and press Enter) manually.');
    }
  }

  // register legacy aliases (kept for compatibility)
  context.subscriptions.push(
    vscode.commands.registerCommand('aiAuditor.analyzeDraft', async () => runAnalyzeAndMaybeSend(false)),
    vscode.commands.registerCommand('aiAuditor.analyzeAndSend', async () => runAnalyzeAndMaybeSend(true)),
  );

  // helper to install external heuristics
  context.subscriptions.push(vscode.commands.registerCommand('cci.installHeuristics', async () => {
    try {
      const cfg = vscode.workspace.getConfiguration('cci');
      const external = cfg.get<string>('externalHeuristicsPath') || '';
      if (!external) return vscode.window.showInformationMessage('Set cci.externalHeuristicsPath in workspace settings to the folder with heuristics.');
      const dest = path.join(context.extensionPath, 'src', 'cci', 'heuristics');
      const { copyExternalHeuristics } = require('./cci/installHeuristics');
      copyExternalHeuristics(external, dest);
      vscode.window.showInformationMessage('CCI: heuristics copied. Rebuild the extension to load them.');
    } catch (e:any) {
      vscode.window.showErrorMessage(`Failed to install heuristics: ${String(e.message||e)}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.applyRevised', async () => {
    if (!lastGrab) {
      vscode.window.showInformationMessage('Revizor: Nothing to apply. Use "Grab Chat Draft" first.');
      return;
    }
    const text = lastGrab.revised;
    if (process.platform === 'linux') {
      await vscode.env.clipboard.writeText(text);
      vscode.window.showInformationMessage('Revizor: Revised text copied. Switch to chat input and paste.');
      return;
    }
    await vscode.env.clipboard.writeText(text);
    try {
      await applySimPasteFromClipboard();
    } catch (e: any) {
      vscode.window.showWarningMessage('Revizor: Paste simulation failed. Text is in clipboard; paste manually.');
    }
  }));

  // diagnostics preview removed — internal diag.show kept where used

  // register C4/C5 commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiAuditor.analyzeWorkspace', analyzeWorkspaceCommand),
    vscode.commands.registerCommand('aiAuditor.revisePrompt', revisePromptCommand),
    // PFP: delegate implemented commands only
    vscode.commands.registerCommand('aiAuditor.scanPfPWorkspace', async () => {
      try { const m = require('./pfp/commands'); await m.scanWorkspaceCommand(context); } catch (e:any) { vscode.window.showInformationMessage('PFP: scanWorkspace failed or not implemented'); }
    }),
    vscode.commands.registerCommand('aiAuditor.exportPfpProfiles', async () => { try { const m = require('./pfp/commands'); await m.exportProfilesCommand(context); } catch (e:any) { vscode.window.showInformationMessage('PFP: exportProfiles failed or not implemented'); } }),
    // CCI: delegate existing logic
    vscode.commands.registerCommand('aiAuditor.scanCCIWorkspace', async () => {
      auditorOutput.appendLine('CCI: Scan Project invoked');
      vscode.window.showInformationMessage('CCI: Scan Project started…');
      try {
        const ws = await pickWorkspaceRoot();
        if (!ws) { auditorOutput.appendLine('CCI: no workspace selected'); vscode.window.showWarningMessage('CCI: No workspace selected'); return; }
        const root = ws.fsPath;
        auditorOutput.appendLine(`CCI: workspace root: ${root}`);
        const { collectFindings } = require('./cci/collector');
        const { loadCciConfig } = require('./cci/config');
        const { submitFindings } = require('./cci/uploader');
        const { publishFindingsReport } = require('./cci/diagnostics');
        let cfg;
        try {
          cfg = loadCciConfig(root);
          auditorOutput.appendLine(`CCI: config loaded (backendUrl set? ${!!cfg.backendUrl})`);
        } catch (e) {
          auditorOutput.appendLine(`CCI: failed to load config: ${String((e as any)?.message || e)}`);
          vscode.window.showErrorMessage('CCI: failed to load config. See AI Auditor output for details.');
          return;
        }

        auditorOutput.appendLine('CCI: collecting findings...');
        const payload = await collectFindings(root, (m: string) => auditorOutput.appendLine(m));
        auditorOutput.appendLine(`CCI: collection complete: files=${payload.fileStats.length}, findings=${payload.findings.length}`);

        const body = { meta: { root }, config: cfg, fileStats: payload.fileStats, findings: payload.findings };
        let report;
        try {
          auditorOutput.appendLine('CCI: submitting findings to backend (if configured)...');
          report = await submitFindings(body, cfg);
          auditorOutput.appendLine('CCI: backend returned report');
        } catch (e) {
          auditorOutput.appendLine(`CCI: submit failed: ${String((e as any)?.message || e)}; using local fallback`);
          // Calculate real CCI instead of hardcoding 100
          const metrics = calculateCCI(payload.findings, payload.fileStats);
          const kiloc = payload.fileStats.reduce((s:any,f:any)=>s+f.nonBlankLines,0)/1000;
          report = { 
            meta: { 
              id: 'local', 
              timestamp: new Date().toISOString(), 
              kiloc: kiloc, 
              total_weight: metrics.total_weight, 
              cdx: metrics.cdx, 
              cci: metrics.cci 
            }, 
            findings: payload.findings 
          };
        }

        auditorOutput.appendLine(`CCI: publishing ${report.findings.length} findings to diagnostics`);
        publishFindingsReport(report);
        try {
          const { writeReportToWorkspace } = require('./cci/collector');
          const auditDir = getAuditDirForWorkspace(root);
          const out = await writeReportToWorkspace(root, report, auditDir);
          auditorOutput.appendLine(`CCI: report file written: ${out}`);
          if (out) vscode.window.showInformationMessage(`CCI: Scan complete — ${report.findings.length} findings. Report saved: ${out}`);
          else vscode.window.showInformationMessage(`CCI: Scan complete — ${report.findings.length} findings`);
        } catch (e) {
          auditorOutput.appendLine(`CCI: failed to write report: ${String((e as any)?.message || e)}`);
          vscode.window.showInformationMessage(`CCI: Scan complete — ${report.findings.length} findings`);
        }
      } catch (e) {
        auditorOutput.appendLine(`CCI scan failed: ${String((e as any)?.message || e)}`);
        vscode.window.showErrorMessage(`CCI scan failed: ${String((e as any)?.message || e)}`);
      }
    }),
    // Build combined report from existing CCI and PFP outputs (extracted)
    vscode.commands.registerCommand('aiAuditor.buildCombinedReport', async () => {
      await buildCombinedReportCommand(auditorOutput);
    }),
    // Simulate upload: legacy .zip (extracted)
    vscode.commands.registerCommand('aiAuditor.simulateUploadArchive', async () => {
      await simulateZipLegacyCommand(auditorOutput);
    }),
    // Simulate upload (standalone): create entropy-input-v1.nzip using local helpers (extracted)
    vscode.commands.registerCommand('aiAuditor.simulateNzip', async () => {
      await simulateNzipCommand(auditorOutput);
    }),

    // legacy alias registrations for simulate archive commands
    vscode.commands.registerCommand('ai-auditor.simulateUploadArchive', async () => {
      await simulateZipLegacyCommand(auditorOutput);
    }),
    vscode.commands.registerCommand('ai-auditor.simulateNzip', async () => {
      await simulateNzipCommand(auditorOutput);
    }),
    // Upload Raw Features commands
    vscode.commands.registerCommand('aiAuditor.uploadRawFeatures', async () => {
      const mod = require('./uploadRawFeatures');
      await mod.uploadRawFeaturesCommand(context, false);
    }),
    vscode.commands.registerCommand('aiAuditor.uploadDryRun', async () => {
      const mod = require('./uploadRawFeatures');
      await mod.uploadRawFeaturesCommand(context, true);
    }),
    // legacy IDs
    vscode.commands.registerCommand('ai-auditor.upload.rawFeatures', async () => {
      const mod = require('./uploadRawFeatures');
      await mod.uploadRawFeaturesCommand(context, false);
    }),
    vscode.commands.registerCommand('ai-auditor.upload.dryRun', async () => {
      const mod = require('./uploadRawFeatures');
      await mod.uploadRawFeaturesCommand(context, true);
    }),
  );

  // apply safe fixes command
  context.subscriptions.push(vscode.commands.registerCommand('aiAuditor.applySafeFixes', async (fileUri?: string) => {
    if (!fileUri) return vscode.window.showInformationMessage('No file specified for safe fixes.');
    const findings = findingsByFile.get(fileUri) || [];
    if (!findings.length) return vscode.window.showInformationMessage('No safe fixes available for this file.');

    const uri = vscode.Uri.parse(fileUri);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    // collect safe edits
    const safeEdits: Array<{ range: vscode.Range; newText: string }> = [];
    for (const f of findings) {
      if (f.kind === 'safeFix' || f.risk === 'safe' || f.kind === 'fix') {
        if (f.edits) {
          for (const e of f.edits) {
            if (!e.range) continue;
            const range = new vscode.Range(e.range.start.line, e.range.start.character, e.range.end.line, e.range.end.character);
            safeEdits.push({ range, newText: e.newText });
          }
        }
      }
    }
    if (!safeEdits.length) return vscode.window.showInformationMessage('No safe edits found for this file.');

    // sort descending and apply as single undo
    safeEdits.sort((a,b) => {
      if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line;
      return b.range.start.character - a.range.start.character;
    });

    const wsEdit = new vscode.WorkspaceEdit();
    for (const se of safeEdits) wsEdit.replace(uri, se.range, se.newText);
    const ok = await vscode.workspace.applyEdit(wsEdit);
    if (ok) {
      vscode.window.showInformationMessage(`Applied ${safeEdits.length} safe edits.`);
    } else {
      vscode.window.showErrorMessage('Failed to apply safe edits.');
    }
  }));

  // Findings open/cancel commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiAuditor.openFindings', async () => {
      auditorOutput.appendLine('Command invoked: aiAuditor.openFindings');
      try {
        if (findingsPanel && typeof findingsPanel.show === 'function') {
          findingsPanel.show && findingsPanel.show();
          auditorOutput.appendLine('findingsPanel.show() executed');
        } else {
          auditorOutput.appendLine('findingsPanel unavailable');
          vscode.window.showInformationMessage('Open Findings panel (not implemented UI yet).');
        }
      } catch (err: any) {
        auditorOutput.appendLine(`auditor.openFindings handler error: ${String(err?.message || err)}`);
        vscode.window.showInformationMessage('Open Findings panel (not implemented UI yet).');
      }
    }),
    vscode.commands.registerCommand('aiAuditor.cancelAnalysis', async () => {
      if (currentAnalysisCancellation) {
        currentAnalysisCancellation.cancel();
        notify('info', 'Analysis canceled');
        setStatusIdle();
      } else {
        vscode.window.showInformationMessage('No running analysis to cancel.');
      }
    })
  );

  // Removed legacy `ai-auditor.*` alias registrations — commands use unified `aiAuditor.*` IDs and titles.

  // C8: CodeAction provider for Auditor findings
  class AuditorCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] | undefined {
      const actions: vscode.CodeAction[] = [];
      for (const diag of context.diagnostics) {
        if (diag.source !== 'Auditor') continue;
        const finding = (diag as any).finding;
        // Safe auto-fix action
        if (finding && finding.edits && Array.isArray(finding.edits) && finding.edits.length) {
          const wsEdit = new vscode.WorkspaceEdit();
          const uri = document.uri;
          // apply only edits for this file
          for (const e of finding.edits) {
            if (!e.range) continue;
            const r = new vscode.Range(e.range.start.line, e.range.start.character, e.range.end.line, e.range.end.character);
            wsEdit.replace(uri, r, e.newText);
          }
          const qa = new vscode.CodeAction('Apply Auditor safe fix', vscode.CodeActionKind.QuickFix);
          qa.edit = wsEdit;
          qa.diagnostics = [diag];
          actions.push(qa);
        }

        // Revise action (opens revise flow)
        const reviseAction = new vscode.CodeAction('Revise with Auditor...', vscode.CodeActionKind.QuickFix);
        reviseAction.command = { command: 'aiAuditor.revisePrompt', title: 'Revise with Auditor', arguments: [] };
        reviseAction.diagnostics = [diag];
        actions.push(reviseAction);
      }
      return actions;
    }
  }

  context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, new AuditorCodeActionProvider(), { providedCodeActionKinds: AuditorCodeActionProvider.providedCodeActionKinds }));
}

export function deactivate() {
  // Cleanup handled by context.subscriptions
}



