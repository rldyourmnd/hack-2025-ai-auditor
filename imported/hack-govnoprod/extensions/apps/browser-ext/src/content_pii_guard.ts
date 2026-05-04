export type PiiSeverity = 'low' | 'medium' | 'high';

export type PiiFinding = {
  fileName: string;
  offset?: number;
  length?: number;
  snippet?: string;
  type: 'email' | 'phone' | 'credit_card' | 'unknown_binary' | 'other';
  severity: PiiSeverity;
  message: string;
};

export type PiiAnalysis = {
  fileName: string;
  findings: PiiFinding[];
  maxSeverity: PiiSeverity;
};

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,6}/g;
const PHONE_RE = /(?:\+\d{1,3}[ \-]?)?(?:\(\d{2,4}\)[ \-]?)?\d{6,14}/g;
const DIGITS_RE = /\d{12,19}/g; // possible CC candidates

function luhnCheck(cc: string) {
  const s = cc.replace(/[^0-9]/g, '');
  let sum = 0; let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let num = parseInt(s.charAt(i), 10);
    if (alt) { num *= 2; if (num > 9) num -= 9; }
    sum += num; alt = !alt;
  }
  return sum % 10 === 0;
}

async function readFileSlice(file: File, maxBytes = 64 * 1024): Promise<string | Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    const slice = file.slice(0, maxBytes);
    reader.onload = () => {
      try {
        const txt = String(reader.result || '');
        resolve(txt);
      } catch (e) { resolve(new Uint8Array()); }
    };
    reader.onerror = () => resolve(new Uint8Array());
    reader.readAsText(slice);
  });
}

export async function scanFilesLocally(files: File[]): Promise<PiiAnalysis[]> {
  const results: PiiAnalysis[] = [];
  for (const f of files) {
    const res: PiiAnalysis = { fileName: f.name || 'unknown', findings: [], maxSeverity: 'low' };
    try {
      const content = await readFileSlice(f, 64 * 1024);
      if (typeof content === 'string') {
        let m: RegExpExecArray | null;
        while ((m = EMAIL_RE.exec(content))) {
          const snippet = m[0];
          res.findings.push({ fileName: res.fileName, offset: m.index, length: snippet.length, snippet, type: 'email', severity: 'high', message: `Email detected: ${snippet}` });
          res.maxSeverity = 'high';
        }
        while ((m = PHONE_RE.exec(content))) {
          const snippet = m[0];
          if (snippet.replace(/\D/g, '').length >= 7) {
            res.findings.push({ fileName: res.fileName, offset: m.index, length: snippet.length, snippet, type: 'phone', severity: 'medium', message: `Phone number detected: ${snippet}` });
            if (res.maxSeverity !== 'high') res.maxSeverity = 'medium';
          }
        }
        while ((m = DIGITS_RE.exec(content))) {
          const snippet = m[0];
          if (luhnCheck(snippet)) {
            res.findings.push({ fileName: res.fileName, offset: m.index, length: snippet.length, snippet: snippet.replace(/.(?=.{4})/g, '*'), type: 'credit_card', severity: 'high', message: `Credit card-like number detected` });
            res.maxSeverity = 'high';
          }
        }
      }
      const txtTypes = ['text/', 'application/json', 'application/xml', 'application/javascript'];
      const isTextLike = (f.type && txtTypes.some(t => f.type.startsWith(t))) || /\.txt$|\.md$|\.csv$/i.test(f.name || '');
      if (!res.findings.length && !isTextLike) {
        res.findings.push({ fileName: res.fileName, type: 'unknown_binary', severity: 'medium', message: 'Binary file: content not scanned fully (first 64KB only)' });
        res.maxSeverity = 'medium';
      }
    } catch (err) {
      res.findings.push({ fileName: res.fileName, type: 'other', severity: 'low', message: 'Scan error' });
    }
    results.push(res);
  }
  return results;
}

export function aggregateMaxSeverity(arr: PiiAnalysis[]): PiiSeverity {
  if (!arr || !arr.length) return 'low';
  if (arr.some(r => r.maxSeverity === 'high')) return 'high';
  if (arr.some(r => r.maxSeverity === 'medium')) return 'medium';
  return 'low';
}


