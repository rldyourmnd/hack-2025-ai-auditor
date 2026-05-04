import * as fs from 'fs';
import * as path from 'path';

export function copyExternalHeuristics(srcDir: string, destDir: string) {
  if (!fs.existsSync(srcDir)) throw new Error(`Source heuristics path not found: ${srcDir}`);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const items = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const it of items) {
    const s = path.join(srcDir, it.name);
    const d = path.join(destDir, it.name);
    if (it.isDirectory()) {
      copyExternalHeuristics(s, d);
    } else {
      // copy only .ts/.js files
      if (/\.(ts|js)$/.test(it.name)) fs.copyFileSync(s, d);
    }
  }
}


