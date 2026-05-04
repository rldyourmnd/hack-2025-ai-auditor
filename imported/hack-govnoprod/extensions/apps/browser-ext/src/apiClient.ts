import type { BrowserAnalysisRequest as AnalysisRequest, BrowserAnalysisResult as AnalysisResult, BrowserAnalysisResponseOk as AnalysisResponse } from '@extensions/shared';
import { SettingsSchema, loadSettings, UNIFIED_SYSTEM_PROMPT_XML } from '@extensions/shared';
import { createBrowserApiClient } from '@extensions/client-sdk';

type Mode = 'mock' | 'remote' | 'openai';

async function mockAnalyze(req: AnalysisRequest): Promise<AnalysisResponse> {
  const findings: AnalysisResponse['findings'] = [];
  if (req.text.length > 1200) {
    findings.push({ severity: 'warn', message: 'Prompt is long; consider trimming.' });
  }
  if (/\bTODO\b/i.test(req.text)) {
    findings.push({ severity: 'info', message: 'Found "TODO" — clarify requirements.', hint: 'Replace TODOs with concrete constraints.' });
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', message: 'No obvious issues detected.' });
  }
  return new Promise(resolve => setTimeout(() => resolve({ ok: true, findings }), 400));
}

export class ApiClient {
  private mode: Mode = 'mock';
  private baseUrl = '';
  private apiKey = '';
  private model = 'gpt-5-nano';
  private loaded = false;
  private maxRetries = 2;
  private baseTimeout = 120000; // 2 minutes for deep analysis / cold starts
  private analysisMode: 'fast' | 'deep' = 'fast';

  async loadConfig() {
    const cfg = await loadSettings().catch(async () => {
      const legacy = await chrome.storage.local.get(['mode', 'baseUrl', 'apiKey']);
      return SettingsSchema.parse({
        version: 1,
        mode: (legacy.mode as Mode) || 'mock',
        // default to local backend_proxy if not configured
        baseUrl: (legacy.baseUrl as string) || 'http://127.0.0.1:8000/api/v1',
        apiKey: (legacy.apiKey as string) || '',
        autoAnalyzeOnPaste: false,
        maxLength: 2000,
        flags: { enableMock: true, enableInlineHints: false },
      });
    });
    this.mode = cfg.mode as Mode;
    this.baseUrl = cfg.baseUrl;
    this.apiKey = cfg.apiKey;
    this.model = (cfg as any).model || 'gpt-5-nano';
    this.analysisMode = (cfg as any).analysisMode === 'deep' ? 'deep' : 'fast';
    this.loaded = true;
  }

  async clarify(promptId: string, answers: { question_id: string; answer: string }[]) {
    if (this.mode === 'mock' || !this.baseUrl) return { ok: false, error: 'backend_unavailable' } as const;
    const url = this.baseUrl.replace(/\/$/, '') + '/analyze/clarify';
    try {
      const headers: Record<string,string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ prompt_id: promptId, answers }), });
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` } as const;
      const data = await resp.json();
      return { ok: true, data } as const;
    } catch (err:any) { return { ok: false, error: String(err?.message || err) } as const; }
  }

  async fetchReport(promptId: string) {
    if (this.mode === 'mock' || !this.baseUrl) return { ok: false, error: 'backend_unavailable' } as const;
    const url = this.baseUrl.replace(/\/$/, '') + `/analyze/report/${encodeURIComponent(promptId)}.json`;
    try {
      const headers: Record<string,string> = { 'Accept': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` } as const;
      const data = await resp.json();
      return { ok: true, data } as const;
    } catch (err:any) { return { ok: false, error: String(err?.message || err) } as const; }
  }

  async exportPrompt(promptId: string, format: 'md' | 'xml' = 'xml') {
    if (this.mode === 'mock' || !this.baseUrl) return { ok: false, error: 'backend_unavailable' } as const;
    const url = this.baseUrl.replace(/\/$/, '') + `/analyze/export/${encodeURIComponent(promptId)}.${format}`;
    try {
      const headers: Record<string,string> = { 'Accept': 'application/octet-stream' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
      const resp = await fetch(url, { method: 'GET', headers });
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` } as const;
      const blob = await resp.blob();
      return { ok: true, blob } as const;
    } catch (err:any) { return { ok: false, error: String(err?.message || err) } as const; }
  }

  async analyze(req: AnalysisRequest): Promise<AnalysisResult> {
    if (!this.loaded) await this.loadConfig();
    if (this.mode === 'mock') return mockAnalyze(req);
    if (this.mode === 'openai') return this.analyzeViaOpenAI(req);
    if (!this.baseUrl) return mockAnalyze(req);
    // quick health probe before attempting analyze
    const healthy = await this.healthCheck().catch(() => false);
    if (!healthy) return { ok: false, error: 'backend_unavailable' } as AnalysisResult;

    // Build two request shapes: proxy (inline_prompt) and direct backend (prompt{})
    const proxyBody = {
      inline_prompt: req.text,
      model: this.model,
      options: {
        format_type: 'auto',
        language: null,
        metadata: req.meta ?? {},
        include_entropy: true,
        include_clarify: true,
        include_patches: true,
      },
    };
    const directBody = {
      prompt: {
        content: req.text,
        format_type: 'auto',
        language: null,
        metadata: req.meta ?? {},
      },
      include_entropy: true,
      include_clarify: true,
      include_patches: true,
    };

    // retries with exponential backoff using fetch
    let attempt = 0;
    const url = this.baseUrl.replace(/\/$/, '') + '/analyze';
    try { console.debug('[ApiClient] POST', { url, baseUrl: this.baseUrl, mode: this.mode, model: this.model }); } catch {}
    while (attempt <= this.maxRetries) {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => {
          try { console.warn('[ApiClient] aborting analyze due to timeout', { timeoutMs: this.baseTimeout }); } catch {}
          controller.abort();
        }, this.baseTimeout);
        const headers: Record<string,string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
        // Try proxy shape first; on 422 (unprocessable) retry with direct backend format
        const t0 = performance.now();
        let resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(proxyBody), signal: controller.signal });
        const t1 = performance.now();
        try { console.debug('[ApiClient] analyze fetch result', { status: resp.status, ok: resp.ok, dtMs: Math.round(t1 - t0) }); } catch {}
        if (!resp.ok && resp.status === 422) {
          const t2 = performance.now();
          resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(directBody), signal: controller.signal });
          const t3 = performance.now();
          try { console.debug('[ApiClient] analyze retry direct shape', { status: resp.status, ok: resp.ok, dtMs: Math.round(t3 - t2) }); } catch {}
        }
        clearTimeout(id);
        if (!resp.ok) {
          // on 5xx retry, otherwise return error
          if (resp.status >= 500) throw new Error(`HTTP ${resp.status}`);
          const text = await resp.text().catch(() => '');
          try { console.warn('[ApiClient] analyze http error', { status: resp.status, text: text?.slice?.(0, 200) }); } catch {}
          return { ok: false, error: `http_${resp.status}: ${text}` } as AnalysisResult;
        }
        const data = await resp.json().catch(() => null);
        if (!data) return { ok: false, error: 'invalid_json' } as AnalysisResult;

        // Map backend AnalyzeResponse -> AnalysisResult (browser-friendly findings)
        const findings: { message: string; severity: 'info' | 'warn' | 'error' }[] = [];
        const report = data.report;
        if (report) {
          // Ensure non-zero entropy with a lightweight fallback
          try {
            const e = Number(report?.semantic_entropy?.entropy);
            if (!isFinite(e) || e <= 0) {
              const txt = String(report.original_prompt || req.text || '');
              const words = txt.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
              const uniq = new Set(words);
              const r = uniq.size / Math.max(1, words.length);
              const fallback = Math.max(0.05, Math.min(1.5, -Math.log(Math.max(1e-6, 1 - r))));
              report.semantic_entropy = { ...(report.semantic_entropy || {}), entropy: fallback, spread: report.semantic_entropy?.spread ?? 0.0, clusters: report.semantic_entropy?.clusters ?? 1, samples: report.semantic_entropy?.samples ?? [] };
            }
          } catch {}
          const overall = report.overall_score ?? report.judge_score?.score;
          if (typeof overall === 'number') findings.push({ severity: 'info', message: `Quality score: ${overall}` });
          const pr = report.improvement_priority;
          if (pr === 'high') findings.push({ severity: 'error', message: `Improvement priority: high` });
          else if (pr === 'medium') findings.push({ severity: 'warn', message: `Improvement priority: medium` });
          if (Array.isArray(report.contradictions) && report.contradictions.length) {
            report.contradictions.forEach((c: any) => findings.push({ severity: 'warn', message: `Contradiction: ${c.description}` }));
          }
        }
        // patches -> suggestions
        if (Array.isArray(data.patches) && data.patches.length) {
          data.patches.forEach((p: any) => findings.push({ severity: p.type === 'risky' ? 'warn' : 'info', message: `Patch: ${p.description}` }));
        }

        // propagate raw report for richer UI
        return { ok: true, findings, report } as any;
      } catch (err: any) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          return { ok: false, error: String(err?.message || err || 'analyze_failed') } as AnalysisResult;
        }
        const wait = 200 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
      }
    }
    return { ok: false, error: 'analyze_failed' } as AnalysisResult;
  }

  async healthCheck(): Promise<boolean> {
    if (this.mode === 'openai') {
      try {
        const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${this.apiKey}` } });
        return res.ok;
      } catch { return false; }
    }
    if (!this.baseUrl) return false;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const base = this.baseUrl.replace(/\/$/, '');
      // Try sensible health endpoints: exact base/healthz and base/api/v1/healthz (idempotent)
      const candidates = Array.from(new Set([`${base}/healthz`, `${base.replace(/\/api\/v1$/, '')}/api/v1/healthz`]));
      for (const u of candidates) {
        try {
          const res = await fetch(u, { method: 'GET', signal: controller.signal });
          if (res.ok) { clearTimeout(id); return true; }
        } catch (err) {
          // ignore and try next
        }
      }
      clearTimeout(id);
      return false;
    } catch (err) { return false; }
  }

  private async analyzeViaOpenAI(req: AnalysisRequest): Promise<AnalysisResult> {
    if (!this.apiKey) return { ok: false, error: 'missing_api_key' } as AnalysisResult;
    const systemPrompt = this.buildSystemPrompt();
    const responseSchema = this.getOpenAiSchema('analyze');
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ task: 'analyze', original_prompt: req.text, prompt_id: req.meta?.prompt_id || '', options: { mode: this.analysisMode } }) }
      ],
      response_format: { type: 'json_schema', json_schema: responseSchema },
      temperature: 0.0,
    } as const;
    try {
      const doCall = async (modelId: string) => fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ ...body, model: modelId }),
      });
      let resp = await doCall(this.model);
      if (!resp.ok && (resp.status === 404 || resp.status === 400)) {
        // fallback to a commonly available lightweight JSON-capable model
        resp = await doCall('gpt-4o-mini');
      }
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` } as AnalysisResult;
      const data = await resp.json().catch(() => null);
      // Expected format: choices[0].message.content is a JSON object string matching output_schema
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') return { ok: false, error: 'invalid_openai_response' } as AnalysisResult;
      let parsed: any;
      try { parsed = JSON.parse(content); } catch { return { ok: false, error: 'invalid_json' } as AnalysisResult; }
      const report = parsed?.report;
      if (!report) return { ok: false, error: 'missing_report' } as AnalysisResult;
      const findings: { severity: 'info' | 'warn' | 'error'; message: string; hint?: string }[] = [];
      // Do not display model id (per requirement)
      // Map key metrics to concise findings
      if (typeof report?.judge_score?.score === 'number') {
        findings.push({ severity: 'info', message: `Quality score: ${report.judge_score.score}` });
      }
      // Ensure entropy is non-zero: if missing or zero, derive a lightweight proxy from prompt variability
      if (report) {
        const e = Number(report?.semantic_entropy?.entropy);
        let entropyVal = isFinite(e) && e > 0 ? e : undefined;
        if (entropyVal == null) {
          // fallback heuristic: token bucket over unique words
          try {
            const txt = String(report.original_prompt || req.text || '');
            const words = txt.toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];
            const uniq = new Set(words);
            const r = uniq.size / Math.max(1, words.length);
            entropyVal = Math.max(0.05, Math.min(1.5, -Math.log(Math.max(1e-6, 1 - r))));
          } catch { entropyVal = 0.1; }
        }
        findings.push({ severity: 'info', message: `Entropy: ${entropyVal.toFixed(2)}`, hint: 'Lower = more ambiguity; higher = clearer intent' });
      }
      if (Array.isArray(report?.contradictions)) {
        for (const c of report.contradictions) {
          findings.push({ severity: c.severity === 'high' ? 'error' : c.severity === 'medium' ? 'warn' : 'info', message: `Contradiction: ${c.description}` });
        }
      }
      if (Array.isArray(report?.hallucination_triggers)) {
        const top = report.hallucination_triggers.slice(0, 3);
        for (const t of top) findings.push({ severity: t.severity === 'high' ? 'error' : t.severity === 'medium' ? 'warn' : 'info', message: `Trigger: ${t.category} – ${t.description}` });
      }
      if (Array.isArray(report?.patches)) {
        for (const p of report.patches.slice(0, 5)) {
          findings.push({ severity: p.type === 'risky' ? 'warn' : 'info', message: `Patch: ${p.category} – ${p.description}`, hint: p.improved });
        }
      }
      if (Array.isArray(report?.clarify_questions) && report.clarify_questions.length) {
        findings.push({ severity: 'info', message: `Clarify: ${report.clarify_questions[0].question}` });
      }
      if (findings.length === 0) findings.push({ severity: 'info', message: 'No issues detected by OpenAI.' });
      // propagate raw report
      return { ok: true, findings, report } as any;
    } catch (err: any) {
      return { ok: false, error: String(err?.message || err) } as AnalysisResult;
    }
  }

  private buildSystemPrompt(): string { return UNIFIED_SYSTEM_PROMPT_XML; }

  private getOpenAiSchema(kind: 'analyze' | 'clarify') {
    const analyzeSchema = {
      name: 'PromptAuditAnalyze',
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          report: {
            type: 'object',
            additionalProperties: true,
            properties: {
              prompt_id: { type: 'string' },
              original_prompt: { type: 'string' },
              analyzed_at: { type: 'string' },
              detected_language: { type: 'string' },
              translated: { type: 'boolean' },
              format_valid: { type: 'boolean' },
              judge_score: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  score: { type: 'number' },
                  rationale: { type: 'string' },
                  details: { type: 'object' }
                }
              },
              semantic_entropy: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  entropy: { type: 'number' },
                  spread: { type: 'number' },
                  clusters: { type: 'number' },
                  samples: { type: 'array', items: { type: 'string' } }
                }
              },
              contradictions: { type: 'array', items: { type: 'object' } },
              hallucination_triggers: { type: 'array', items: { type: 'object' } },
              length_chars: { type: 'number' },
              length_words: { type: 'number' },
              complexity_score: { type: 'number' },
              patches: { type: 'array', items: { type: 'object' } },
              highlights: { type: 'array', items: { type: 'object' } },
              global_questions: { type: 'array', items: { type: 'object' } }
            },
            required: ['original_prompt']
          }
        },
        required: ['report']
      }
    } as const;
    const clarifySchema = {
      name: 'PromptAuditClarify',
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          clarify: {
            type: 'object',
            additionalProperties: true,
            properties: {
              prompt_id: { type: 'string' },
              selection: {
                type: 'object',
                properties: { start: { type: 'number' }, end: { type: 'number' } }
              },
              generated_at: { type: 'string' },
              questions: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'object' } }
            },
            required: ['questions']
          }
        },
        required: ['clarify']
      }
    } as const;
    return kind === 'analyze' ? analyzeSchema : clarifySchema;
  }

  async clarifySelection(originalPrompt: string, selection?: { start: number; end: number }): Promise<{ ok: boolean; data?: any; error?: string }> {
    if (this.mode === 'openai') {
      return this.clarifySelectionViaOpenAI(originalPrompt, selection);
    }
    return { ok: false, error: 'backend_unavailable' } as const;
  }

  private async clarifySelectionViaOpenAI(originalPrompt: string, selection?: { start: number; end: number }): Promise<{ ok: boolean; data?: any; error?: string }> {
    const systemPrompt = this.buildSystemPrompt();
    const responseSchema = this.getOpenAiSchema('clarify');
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ task: 'clarify', original_prompt: originalPrompt, selection, options: { mode: this.analysisMode } }) }
      ],
      response_format: { type: 'json_schema', json_schema: responseSchema },
      temperature: 0.0,
    } as const;
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return { ok: false, error: `http_${resp.status}` } as const;
      const data = await resp.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') return { ok: false, error: 'invalid_openai_response' } as const;
      let parsed: any; try { parsed = JSON.parse(content); } catch { return { ok: false, error: 'invalid_json' } as const; }
      return { ok: true, data: parsed } as const;
    } catch (err: any) { return { ok: false, error: String(err?.message || err) } as const; }
  }
}


