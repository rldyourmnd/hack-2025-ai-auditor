import { FindingsPayload, FindingsReport, CciConfig } from "./types";
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpPost(urlStr: string, headers: Record<string,string>, body: string, timeoutMs: number) {
  return new Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }>((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const lib = url.protocol === 'https:' ? https : http;
      const opts: any = { method: 'POST', hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80), path: url.pathname + (url.search || ''), headers };
      const req = lib.request(opts, (res: any) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const txt = buf.toString('utf8');
          const status = res.statusCode || 0;
          resolve({ ok: status >= 200 && status < 300, status, text: async () => txt, json: async () => { try { return JSON.parse(txt); } catch { throw new Error('Invalid JSON'); } } });
        });
      });
      req.on('error', (err: any) => reject(err));
      req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
      req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

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

export async function submitFindings(payload: FindingsPayload, config: CciConfig): Promise<FindingsReport> {
  const url = (config.backendUrl || '').replace(/\/$/, "") + "/api/v1/cci/submit-findings";
  const max = config.maxPayloadBytes;

  // split findings/fileStats into chunks by approximate JSON size
  const base = { meta: payload.meta, config: payload.config } as any;
  const findingsChunks = chunkArray(payload.findings || [], 200);
  const fileStatsChunks = chunkArray(payload.fileStats || [], 200);

  // send iteratively: for simplicity send pairs of chunks
  let attempt = 0;
  const maxAttempts = 4;
  if (config.offlineMode || !config.backendUrl) {
    // Calculate real CCI instead of hardcoding 100
    const metrics = calculateCCI(payload.findings || [], payload.fileStats || []);
    const kiloc = (payload.fileStats || []).reduce((s:any,f:any)=>s+f.nonBlankLines,0)/1000;
    
    // do not attempt network calls; return local aggregated report
    return { 
      meta: { 
        id: 'local', 
        timestamp: new Date().toISOString(), 
        kiloc: kiloc, 
        total_weight: metrics.total_weight, 
        cdx: metrics.cdx, 
        cci: metrics.cci 
      }, 
      findings: payload.findings || [] 
    };
  }

  for (let i = 0; i < Math.max(findingsChunks.length, fileStatsChunks.length); i++) {
    const bodyObj = { ...base, findings: findingsChunks[i] || [], fileStats: fileStatsChunks[i] || [] };
    const body = JSON.stringify(bodyObj);
    attempt = 0;
    while (true) {
      try {
        const headers: Record<string,string> = { 'Content-Type': 'application/json', ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}) };
        const res = await httpPost(url, headers, body, config.timeoutMs);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text}`);
        }
        const parsed = await res.json() as FindingsReport;
        return parsed;
      } catch (e) {
        attempt++;
        if (attempt >= maxAttempts) throw e;
        const backoff = Math.pow(2, attempt) * 100 + Math.floor(Math.random() * 100);
        await sleep(backoff);
        continue;
      }
    }
  }
  // fallback empty report - should not happen in normal flow
  const fallbackMetrics = calculateCCI(payload.findings || [], payload.fileStats || []);
  const fallbackKiloc = (payload.fileStats || []).reduce((s:any,f:any)=>s+f.nonBlankLines,0)/1000;
  return { 
    meta: { 
      id: 'local', 
      timestamp: new Date().toISOString(), 
      kiloc: fallbackKiloc, 
      total_weight: fallbackMetrics.total_weight, 
      cdx: fallbackMetrics.cdx, 
      cci: fallbackMetrics.cci 
    }, 
    findings: payload.findings || [] 
  };
}


