import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const DEFAULT_DIR = '.audit';
const DEFAULT_FILE = 'profiles.jsonl';

function isValidPfpString(pfp: any) {
  if (typeof pfp !== 'string') return false;
  if (!pfp.startsWith('pfp2:')) return true; // accept non-pfp entries
  const payload = pfp.slice(5);
  // Ascii85 valid printable range roughly 33 (!) .. 117 (u)
  return /^[\x21-\x75]+$/.test(payload);
}

export async function ensureStore(wsRoot: string) {
  // allow overriding target directory via global audit.directory setting
  try {
    const cfg = vscode.workspace.getConfiguration();
    const rel = (cfg.get<string>('audit.directory', DEFAULT_DIR) || DEFAULT_DIR).trim();
    const dir = path.isAbsolute(rel) ? rel : path.join(wsRoot, rel);
    await fs.promises.mkdir(dir, { recursive: true });
    return { dir, file: path.join(dir, DEFAULT_FILE) };
  } catch {
    const dir = path.join(wsRoot, DEFAULT_DIR);
    await fs.promises.mkdir(dir, { recursive: true });
    return { dir, file: path.join(dir, DEFAULT_FILE) };
  }
}

export async function appendProfile(wsRoot: string, record: any) {
  const { file } = await ensureStore(wsRoot);
  // Guard against invalid pfp payloads leaking into the store
  if (record && record.pfp && !isValidPfpString(record.pfp)) {
    record = { ...record, pfp: null };
  }
  const line = JSON.stringify(record) + '\n';
  await fs.promises.appendFile(file, line, { encoding: 'utf8' });
}

export default { ensureStore, appendProfile };


