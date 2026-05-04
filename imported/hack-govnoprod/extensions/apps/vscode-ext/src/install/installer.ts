import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';

export type InstallMode = 'portable' | 'installer';

export interface AhkAssets {
  root: string;
  installerDir: string;
  portableDir: string;
  hashesPath: string;
  templatePath: string;
}

export interface ScriptConfig {
  autohotkeyPath: string;
  scriptDir: string;
  logDir: string;
  preprompt: string;
  hooksJson?: string;
  dlpBatPath?: string;
}

export interface InstallResult {
  ahkPath: string;
  scriptPath: string;
}

export function resolveAhkAssets(context: vscode.ExtensionContext): AhkAssets {
  const root = path.join(context.extensionPath, 'assets', 'bin', 'ahk');
  return {
    root,
    installerDir: path.join(root, 'installer'),
    portableDir: path.join(root, 'portable'),
    hashesPath: path.join(root, 'hashes.json'),
    templatePath: path.join(root, 'script.ahk.tpl'),
  };
}

export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    } catch (e) { reject(e); }
  });
}

function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

export function readHashes(hashesPath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(hashesPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string,string>;
  } catch {}
  return {};
}

export async function copyAndVerify(src: string, dest: string, expectedSha?: string): Promise<{ ok: boolean; actualSha: string }> {
  await fs.promises.copyFile(src, dest);
  const actualSha = await computeFileSha256(dest);
  if (expectedSha && expectedSha.length > 0) {
    return { ok: expectedSha.toLowerCase() === actualSha.toLowerCase(), actualSha };
  }
  return { ok: true, actualSha };
}

// Best-effort dynamic detection of installed AutoHotkey.exe without user prompts
export async function detectSystemAhk(): Promise<string | null> {
  if (process.platform !== 'win32') return null;

  const execCmd = (cmd: string) => new Promise<string>((resolve) => {
    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err) return resolve('');
      resolve(String(stdout || '').trim());
    });
  });

  // 1) Try `where` first (fast and reliable when in PATH)
  try {
    const whereOut = await execCmd('cmd /c where AutoHotkey.exe');
    if (whereOut) {
      const first = whereOut.split(/\r?\n/).map(s => s.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  } catch {}

  // 2) Try registry (Uninstall entries) for InstallLocation/DisplayIcon
  try {
    const regPs = 'powershell -NoProfile -Command "' +
      '(Get-ItemProperty \"HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\" ' +
      '| Where-Object { $_.DisplayName -match \"AutoHotkey\" } ' +
      '| Select-Object -First 1 -Property InstallLocation, DisplayIcon) | ConvertTo-Json -Compress"';
    const regOut = await execCmd(regPs);
    if (regOut) {
      try {
        const j: any = JSON.parse(regOut);
        const loc = String(j?.InstallLocation || '').trim();
        const icon = String(j?.DisplayIcon || '').trim();
        const candidates: string[] = [];
        if (loc) candidates.push(path.join(loc, 'AutoHotkey.exe'), path.join(loc, 'v2', 'AutoHotkey.exe'));
        if (icon) {
          const cleaned = icon.replace(/,\s*\d+$/, '').replace(/^"|"$/g, '');
          if (/AutoHotkey\.exe$/i.test(cleaned)) candidates.push(cleaned);
        }
        for (const c of candidates) if (c && fs.existsSync(c)) return c;
      } catch {}
    }
    // WOW6432Node fallback
    const regPsWow = 'powershell -NoProfile -Command "' +
      '(Get-ItemProperty \"HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*\" ' +
      '| Where-Object { $_.DisplayName -match \"AutoHotkey\" } ' +
      '| Select-Object -First 1 -Property InstallLocation, DisplayIcon) | ConvertTo-Json -Compress"';
    const regOutWow = await execCmd(regPsWow);
    if (regOutWow) {
      try {
        const j: any = JSON.parse(regOutWow);
        const loc = String(j?.InstallLocation || '').trim();
        const icon = String(j?.DisplayIcon || '').trim();
        const candidates: string[] = [];
        if (loc) candidates.push(path.join(loc, 'AutoHotkey.exe'), path.join(loc, 'v2', 'AutoHotkey.exe'));
        if (icon) {
          const cleaned = icon.replace(/,\s*\d+$/, '').replace(/^"|"$/g, '');
          if (/AutoHotkey\.exe$/i.test(cleaned)) candidates.push(cleaned);
        }
        for (const c of candidates) if (c && fs.existsSync(c)) return c;
      } catch {}
    }
  } catch {}

  // 3) Probe common Program Files locations and immediate AutoHotkey folders
  const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env['ProgramW6432']].filter(Boolean) as string[];
  const found: string[] = [];

  for (const r of roots) {
    try {
      // direct expected paths
      const direct1 = path.join(r, 'AutoHotkey', 'v2', 'AutoHotkey.exe');
      const direct2 = path.join(r, 'AutoHotkey', 'AutoHotkey.exe');
      if (fs.existsSync(direct1)) found.push(direct1);
      if (fs.existsSync(direct2)) found.push(direct2);

      // scan immediate children for AutoHotkey-like folders (no deep recursion)
      const entries = fs.readdirSync(r, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (/autohotkey/i.test(e.name)) {
          const p1 = path.join(r, e.name, 'AutoHotkey.exe');
          const p2 = path.join(r, e.name, 'v2', 'AutoHotkey.exe');
          if (fs.existsSync(p1)) found.push(p1);
          if (fs.existsSync(p2)) found.push(p2);
        }
      }
    } catch {}
  }

  // 4) If multiple candidates found, pick the newest by mtime
  const uniq = Array.from(new Set(found));
  if (uniq.length === 1) return uniq[0];
  if (uniq.length > 1) {
    try {
      uniq.sort((a,b) => {
        try { return (fs.statSync(b).mtimeMs || 0) - (fs.statSync(a).mtimeMs || 0); } catch { return 0; }
      });
      return uniq[0];
    } catch {}
  }

  return null;
}

// No-op helpers to keep command wiring safe (we do not persist paths now)
export function clearSavedAhkPath(_context: vscode.ExtensionContext) { /* no-op */ }
export function saveAhkPath(_context: vscode.ExtensionContext, _p: string) { /* no-op */ }

export async function pickBundledInstaller(assets: AhkAssets): Promise<string | null> {
  try {
    const files = await fs.promises.readdir(assets.installerDir);
    const exes = files.filter(f => /\.exe$/i.test(f) && !/setup\.exe$/i.test(f));
    if (!exes.length) return null;
    const archToken = process.arch === 'ia32' ? '32' : '64';
    const prefer = (token: string) => {
      const nonUia = exes.filter(f => new RegExp(`^autohotkey${token}(?:\.exe)$`, 'i').test(f));
      if (nonUia.length) return nonUia[0];
      const uia = exes.filter(f => new RegExp(`^autohotkey${token}_uia(?:\.exe)$`, 'i').test(f));
      if (uia.length) return uia[0];
      // relaxed matching (names may vary order)
      const nonUiaLoose = exes.filter(f => new RegExp(`${token}`, 'i').test(f) && !/_uia/i.test(f));
      if (nonUiaLoose.length) return nonUiaLoose[0];
      const uiaLoose = exes.filter(f => new RegExp(`${token}`, 'i').test(f) && /_uia/i.test(f));
      if (uiaLoose.length) return uiaLoose[0];
      return null;
    };
    const picked = prefer(archToken) || prefer(archToken === '64' ? '32' : '64') || exes[0];
    return picked ? path.join(assets.installerDir, picked) : null;
  } catch {
    return null;
  }
}

export async function pickBundledPortable(assets: AhkAssets): Promise<string | null> {
  try {
    const collect = async (dir: string) => {
      try { return (await fs.promises.readdir(dir)).map(n => ({ dir, name: n })); } catch { return []; }
    };
    const list = [
      ...(await collect(assets.portableDir)),
      ...(await collect(assets.installerDir)), // allow shipping interpreters under installer/
    ];
    const exes = list.filter(f => /\.exe$/i.test(f.name) && !/setup\.exe$/i.test(f.name));
    if (!exes.length) return null;

    const archToken = process.arch === 'ia32' ? '32' : '64';
    const prefers = (token: string) => {
      const nonUia = exes.filter(f => new RegExp(token).test(f.name) && !/_uia/i.test(f.name));
      if (nonUia.length) return nonUia[0];
      const uia = exes.filter(f => new RegExp(token).test(f.name) && /_uia/i.test(f.name));
      if (uia.length) return uia[0];
      return null;
    };
    const picked = prefers(archToken) || prefers(archToken === '64' ? '32' : '64') || exes[0];
    return path.join(picked.dir, picked.name);
  } catch { return null; }
}

export async function generateAhkFromTemplate(context: vscode.ExtensionContext, cfg: ScriptConfig): Promise<string> {
  const assets = resolveAhkAssets(context);
  const tpl = await fs.promises.readFile(assets.templatePath, 'utf8');
  const replaced = tpl
    .replace('{SCRIPT_DIR}', cfg.scriptDir)
    .replace('{LOG_DIR}', cfg.logDir)
    .replace('{PREPROMPT}', cfg.preprompt ?? '')
    .replace('{HOOKS}', cfg.hooksJson ?? '[]')
    .replace('{DLP_BAT_PATH}', cfg.dlpBatPath || '');
  ensureDir(cfg.scriptDir);
  const scriptPath = path.join(cfg.scriptDir, 'script.ahk');
  await fs.promises.writeFile(scriptPath, replaced.replace(/\n/g, '\r\n'), 'utf8');
  return scriptPath;
}

export async function launchAhkScript(ahkExePath: string, scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const quotedExe = `"${ahkExePath}"`;
    const quotedScript = `"${scriptPath}"`;
    const ps = process.platform === 'win32'
      ? `Start-Process -FilePath ${quotedExe} -ArgumentList ${quotedScript} -WindowStyle Hidden`
      : `${quotedExe} ${quotedScript} & disown`;
    exec(process.platform === 'win32' ? `powershell -NoProfile -ExecutionPolicy Bypass -Command ${ps}` : ps, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function installUsingInstaller(context: vscode.ExtensionContext, out: vscode.OutputChannel): Promise<string | null> {
  const assets = resolveAhkAssets(context);
  const bundled = await pickBundledInstaller(assets);
  if (!bundled) { out.appendLine('AHK installer not found in assets.'); return null; }
  const hashes = readHashes(assets.hashesPath);
  const relKey = `installer/${path.basename(bundled)}`.replace(/\\/g, '/');
  const expected = hashes[relKey] || '';

  // Copy installer to globalStoragePath/bin for execution
  const binDir = path.join(context.globalStoragePath, 'bin');
  ensureDir(binDir);
  const localInstaller = path.join(binDir, path.basename(bundled));
  const { ok, actualSha } = await copyAndVerify(bundled, localInstaller, expected);
  out.appendLine(`AHK installer copied. sha256=${actualSha}${expected ? ` expected=${expected}` : ''}`);
  if (expected && !ok) { out.appendLine('Hash mismatch for installer. Aborting.'); return null; }

  // These installers are actually portable interpreters (AutoHotkey32/64[_UIA].exe),
  // so we skip any install step and just return the copied path to run scripts with.
  return localInstaller;
}

export async function installUsingPortable(context: vscode.ExtensionContext, out: vscode.OutputChannel): Promise<string | null> {
  const assets = resolveAhkAssets(context);
  const bundled = await pickBundledPortable(assets);
  if (!bundled) { out.appendLine('AHK portable not found in assets.'); return null; }
  const hashes = readHashes(assets.hashesPath);
  const base = path.basename(bundled);
  const relPortable = `portable/${base}`.replace(/\\/g, '/');
  const relInstaller = `installer/${base}`.replace(/\\/g, '/');
  const expected = hashes[relPortable] || hashes[relInstaller] || '';

  const binDir = path.join(context.globalStoragePath, 'bin');
  ensureDir(binDir);
  const localExe = path.join(binDir, path.basename(bundled));
  const { ok, actualSha } = await copyAndVerify(bundled, localExe, expected);
  out.appendLine(`AHK portable copied. sha256=${actualSha}${expected ? ` expected=${expected}` : ''}`);
  if (expected && !ok) { out.appendLine('Hash mismatch for portable. Aborting.'); return null; }
  return localExe;
}

export async function fullInstallFlow(context: vscode.ExtensionContext, out: vscode.OutputChannel): Promise<InstallResult | null> {
  // Always prefer bundled installer first (no user prompts)
  let ahkPath = (await installUsingInstaller(context, out)) || '';
  if (!ahkPath) {
    ahkPath = (await installUsingPortable(context, out)) || '';
  }
  if (!ahkPath) { return null; }

  const scriptsDir = path.join(context.globalStoragePath, 'scripts');
  const logsDir = path.join(context.globalStoragePath, 'logs');
  ensureDir(scriptsDir); ensureDir(logsDir);
  const dlpBat = path.join(context.extensionPath, 'helper', process.platform === 'win32' ? 'dlp-cli.bat' : '');
  const helperPortFile = path.join(context.globalStoragePath, 'ahk_helper_port.txt');
  const scriptPath = await generateAhkFromTemplate(context, {
    autohotkeyPath: ahkPath,
    scriptDir: scriptsDir,
    logDir: logsDir,
    preprompt: '',
    hooksJson: '[]',
    dlpBatPath: dlpBat,
  });
  // inject helper port path in-place (template supports it); ensure CRLF preserved
  try {
    let content = await fs.promises.readFile(scriptPath, 'utf8');
    content = content.replace('{HELPER_PORT_FILE}', helperPortFile.replace(/\\/g,'\\\\'));
    await fs.promises.writeFile(scriptPath, content, 'utf8');
  } catch {}

  await launchAhkScript(ahkPath, scriptPath);
  return { ahkPath, scriptPath };
}


