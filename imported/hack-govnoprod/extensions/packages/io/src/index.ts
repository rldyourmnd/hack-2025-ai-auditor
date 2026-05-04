import * as fs from 'fs';
import * as zlib from 'zlib';
import * as stream from 'stream';
import { pipeline as _pipeline } from 'stream';
import { promisify } from 'util';
import * as crypto from 'crypto';
import FastGlob from 'fast-glob';
import { createReadStream, createWriteStream } from 'fs';
const pipeline = promisify(_pipeline as any);

export async function makeTempDir(prefix = 'ai-auditor-') {
  const tmp = fs.mkdtempSync(require('os').tmpdir() + '/' + prefix);
  return tmp;
}

export async function sha256File(path: string) {
  return new Promise<string>((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const rs = createReadStream(path);
    rs.on('error', reject);
    rs.on('data', (b) => h.update(b));
    rs.on('end', () => resolve(h.digest('hex')));
  });
}

export async function toNdjsonGz(filePaths: string[], outPath: string, stripKeys: string[] = [], logger: (m: string) => void = () => {}) : Promise<number> {
  // stream write through gzip
  const gzip = zlib.createGzip();
  const out = createWriteStream(outPath);
  let lines = 0;
  // writable that counts lines
  const writable = new stream.Writable({
    write(chunk, _enc, cb) {
      out.write(chunk, cb);
    }
  });

  function isValidPfpString(pfp: any) {
    if (typeof pfp !== 'string') return false;
    if (!pfp.startsWith('pfp2:')) return true; // accept non-pfp entries
    const payload = pfp.slice(5);
    // Ascii85 valid printable range roughly 33 (!) .. 117 (u)
    return /^[\x21-\x75]+$/.test(payload);
  }

  for (const p of filePaths) {
    logger(`Processing source: ${p}`);
    // determine type by extension
    const lower = p.toLowerCase();
    if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) {
      // stream lines
      const rs = createReadStream(p, { encoding: 'utf8' });
      let carry = '';
      for await (const chunk of rs as any) {
        carry += chunk;
        let idx;
        while ((idx = carry.indexOf('\n')) >= 0) {
          const line = carry.slice(0, idx);
          carry = carry.slice(idx + 1);
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj && obj.pfp && !isValidPfpString(obj.pfp)) {
              logger(`Skipping profile with invalid pfp in ${p} (approx line ${lines}): ${String(obj.path||obj.file||'unknown')}`);
              continue;
            }
            for (const k of stripKeys) delete obj[k];
            const outLine = JSON.stringify(obj) + '\n';
            gzip.write(outLine);
            lines++;
          } catch (e:any) {
            logger(`Invalid JSON line in ${p}: ${String(e?.message||e)}`);
            continue;
          }
        }
      }
      if (carry.trim()) {
        try {
          const obj = JSON.parse(carry);
          if (obj && obj.pfp && !isValidPfpString(obj.pfp)) {
            logger(`Skipping trailing profile with invalid pfp in ${p}`);
          } else {
            for (const k of stripKeys) delete obj[k];
            gzip.write(JSON.stringify(obj) + '\n');
            lines++;
          }
        } catch (e:any) { logger(`Invalid trailing JSON in ${p}: ${String(e?.message||e)}`); }
      }
    } else if (lower.endsWith('.json')) {
      // parse array streaming not implemented fully; read chunked but safe for moderate files
      const content = await fs.promises.readFile(p, 'utf8');
      try {
        let arr = JSON.parse(content);
        // support wrappers: { findings: [...] } or { profiles: [...] }
        if (!Array.isArray(arr)) {
          if (arr && Array.isArray((arr as any).findings)) {
            arr = (arr as any).findings;
          } else if (arr && Array.isArray((arr as any).profiles)) {
            arr = (arr as any).profiles;
          } else {
            logger(`JSON file ${p} is not an array — attempting to skip`);
            arr = [];
          }
        }
        for (const obj of arr) {
          if (obj && obj.pfp && !isValidPfpString(obj.pfp)) {
            logger(`Skipping profile with invalid pfp in ${p}: ${String(obj.path||obj.file||'unknown')}`);
            continue;
          }
          for (const k of stripKeys) delete obj[k];
          gzip.write(JSON.stringify(obj) + '\n');
          lines++;
        }
      } catch (e:any) {
        logger(`Invalid JSON file ${p}: ${String(e?.message||e)}`);
      }
    } else {
      logger(`Skipping unsupported file: ${p}`);
    }
  }

  gzip.end();
  await new Promise<void>((res, rej) => { gzip.pipe(out).on('finish', res).on('error', rej); });
  return lines;
}

export async function zipFiles(outZip: string, entries: Array<{ name: string; path: string }>) {
  const Yazl = require('yazl');
  const zipfile = new Yazl.ZipFile();
  for (const e of entries) {
    zipfile.addFile(e.path, e.name);
  }
  zipfile.end();
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(outZip);
    zipfile.outputStream.pipe(ws).on('close', resolve).on('error', reject);
  });
}

export async function globMany(globs: string[], cwd: string) {
  const res = await FastGlob(globs, { cwd, absolute: true, dot: true, onlyFiles: true });
  return res;
}

export async function httpUpload(url: string, zipPath: string, token?: string, headers: Record<string,string> = {}, opts: { retry?: number, chunked?: boolean, partSize?: number } = {}) {
  const { request } = require('undici');
  const stat = await fs.promises.stat(zipPath);
  const size = stat.size;
  const retry = typeof opts.retry === 'number' ? opts.retry : 2;
  const chunked = !!opts.chunked;
  const partSize = opts.partSize || 5 * 1024 * 1024; // 5MB default

  const hdrsBase: Record<string,string> = { 'content-type': 'application/zip', ...headers };
  if (token) hdrsBase['authorization'] = `Bearer ${token}`;

  // Simple full upload
  if (!chunked || size <= partSize) {
    const rs = createReadStream(zipPath);
    const hdrs = { ...hdrsBase, 'content-length': String(size), 'X-Upload-Id': headers['X-Upload-Id'] || headers['x-upload-id'] || '' };
    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const r = await request(url, { method: 'POST', body: rs, headers: hdrs });
        const body = await r.body.text().catch(() => '');
        return { status: r.statusCode, body };
      } catch (e:any) {
        if (attempt === retry) throw e;
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
  }

  // Chunked upload flow (init -> parts -> complete)
  // Expect server APIs as described by contract
  const cryptoHash = crypto.createHash('sha256');
  // compute sha while streaming
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(zipPath);
    rs.on('data', (b) => cryptoHash.update(b));
    rs.on('end', () => resolve());
    rs.on('error', (e) => reject(e));
  });
  const sha = cryptoHash.digest('hex');

  // init
  const initBody = JSON.stringify({ size, parts: Math.ceil(size / partSize), sha256: sha });
  const initRes = await request(url.replace(/\/upload$/,'/multipart/init'), { method: 'POST', body: initBody, headers: { 'content-type': 'application/json', ...hdrsBase } });
  if (initRes.statusCode >= 400) {
    const text = await initRes.body.text().catch(() => '');
    return { status: initRes.statusCode, body: text };
  }
  const initJson = await initRes.body.text().then((t: string) => { try { return JSON.parse(t); } catch { return null; } });
  const uploadId = initJson?.upload_id || initJson?.uploadId || headers['X-Upload-Id'] || '';
  const serverPartSize = initJson?.part_size || partSize;

  const parts = Math.ceil(size / serverPartSize);
  // upload parts
  const fd = await fs.promises.open(zipPath, 'r');
  const partsInfo: Array<{ no: number; sha256: string }> = [];
  for (let i = 0; i < parts; i++) {
    const start = i * serverPartSize;
    const len = Math.min(serverPartSize, size - start);
    const buf = Buffer.allocUnsafe(len);
    await fd.read(buf, 0, len, start);
    const partSha = crypto.createHash('sha256').update(buf).digest('hex');
    // PUT part
    const partUrl = url.replace(/\/upload$/,'/multipart/part') + `?upload_id=${uploadId}&part_no=${i+1}`;
    const putRes = await request(partUrl, { method: 'PUT', body: buf, headers: { 'content-type': 'application/octet-stream', 'content-length': String(len), ...hdrsBase } });
    const partBody = await putRes.body.text().catch(() => '');
    if (putRes.statusCode >= 400) {
      await fd.close();
      return { status: putRes.statusCode, body: partBody };
    }
    partsInfo.push({ no: i+1, sha256: partSha });
  }
  await fd.close();

  // complete
  const completeBody = JSON.stringify({ upload_id: uploadId, parts: partsInfo.map(p => ({ no: p.no, sha256: p.sha256 })) });
  const compRes = await request(url.replace(/\/upload$/,'/multipart/complete'), { method: 'POST', body: completeBody, headers: { 'content-type': 'application/json', ...hdrsBase } });
  const compText = await compRes.body.text().catch(() => '');
  return { status: compRes.statusCode, body: compText };
}

export async function httpGet(url: string, token?: string, headers: Record<string,string> = {}, opts: { timeoutMs?: number, retry?: number } = {}) {
  const { request } = require('undici');
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 5000;
  const retry = typeof opts.retry === 'number' ? opts.retry : 0;
  const hdrsBase: Record<string,string> = { ...headers };
  if (token) hdrsBase['authorization'] = `Bearer ${token}`;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const r = await request(url, { method: 'GET', headers: hdrsBase });
      const body = await r.body.text().catch(() => '');
      return { status: r.statusCode, body, json: async () => { try { return JSON.parse(body); } catch { throw new Error('Invalid JSON'); } } };
    } catch (e:any) {
      if (attempt === retry) throw e;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
  }
  // should not reach here
  return { status: 0, body: '' };
}


