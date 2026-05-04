// Fast lexical pass scaffold: count imports, functions, async functions, try/except, print/log occurrences
import * as fs from 'fs';

export function fastLexFromSource(src: string) {
  const imports = (src.match(/^\s*(from\s+\S+|import\s+\S+)/gm) || []).length;
  const funcs = (src.match(/^\s*def\s+\w+/gm) || []).length;
  const asyncFuncs = (src.match(/^\s*async\s+def\s+\w+/gm) || []).length;
  const tryBlocks = (src.match(/^\s*try\s*:/gm) || []).length;
  const exceptBlocks = (src.match(/^\s*except\s+/gm) || []).length;
  const printCalls = (src.match(/\bprint\s*\(/g) || []).length;
  const logCalls = (src.match(/\blogging\.|\bstructlog\.|\bloguru\./g) || []).length;
  const httpCalls = (src.match(/\brequests\.|\bhttpx\.|\baiohttp\./g) || []).length;
  const yamlUnsafe = (src.match(/yaml\.load\s*\(/g) || []).length;
  return { imports, funcs, asyncFuncs, tryBlocks, exceptBlocks, printCalls, logCalls, httpCalls, yamlUnsafe };
}

export async function fastLexFromPath(p: string) {
  const s = await fs.promises.readFile(p, 'utf8');
  return fastLexFromSource(s);
}

export default { fastLexFromSource, fastLexFromPath };


