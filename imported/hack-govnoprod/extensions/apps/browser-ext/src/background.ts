import type { AnalysisRequest, AnalysisResult } from './types';
import { MessageTypes } from '@extensions/messaging';
import { runLengthDetector, runPiiDetector } from '@extensions/core';
import { ApiClient } from './apiClient';
const client = new ApiClient();
client.loadConfig();
try { console.log('[BG] ready'); } catch {}

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.storage.local.set({ lastReadyAt: Date.now() }); } catch {}
});

chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, sendResponse: (resp: any) => void) => {
  (async () => {
    // fallback injection request from content script
    if (msg?.type === 'FALLBACK_INJECT_PAGE_SCRIPT') {
      try {
        const tabId = msg.payload && msg.payload.tabId;
        if (typeof tabId === 'number' && chrome.scripting && chrome.scripting.executeScript) {
          try {
            await chrome.scripting.executeScript({ target: { tabId }, files: ['public/page-inject.js'] });
            sendResponse({ ok: true });
            return;
          } catch (e) {
            try { console.warn('[BG] scripting.executeScript failed', e); } catch {}
            sendResponse({ ok: false, error: String(e) });
            return;
          }
        }
      } catch (e) { try { console.error('[BG] FALLBACK_INJECT_PAGE_SCRIPT error', e); } catch {} }
    }
    if (msg?.type === MessageTypes.PING) {
      sendResponse({ ok: true, ts: Date.now() });
      return;
    }
    // No special STORE_AND_OPEN_POPUP handling: content script drives UI
    if (msg?.type === MessageTypes.ANALYZE_PROMPT) {
      const lastReadyAt = Date.now();
      await chrome.storage.local.set({ lastReadyAt });
      const req = msg.payload as AnalysisRequest;
      // Ensure client has freshest settings (reload in case options changed)
      try { await client.loadConfig(); } catch (e) { /* ignore */ }
      // quick local heuristics first
      const localFindings = [...runLengthDetector(req.text), ...runPiiDetector(req.text)]
        .map(f => ({
          severity: f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warn' : 'info',
          message: f.message,
        }));
      // extra debug: log request summary and client settings
      try { console.debug('[BG] analyze start', { len: req.text?.length, source: req.source, url: req.url }); } catch {}
      try { console.debug('[BG] ApiClient state', { mode: (client as any).mode, baseUrl: (client as any).baseUrl, loaded: (client as any).loaded }); } catch {}
      let remote: any;
      try {
        remote = await client.analyze(req);
      } catch (err:any) {
        try { console.error('[BG] analyze threw', err); } catch {}
        remote = { ok: false, error: String(err?.message || err) };
      }
      // If remote failed due to backend being offline, fallback to local-only results
      let result: AnalysisResult;
      if (!remote.ok && remote.error === 'backend_unavailable') {
        result = { ok: true, findings: localFindings as any } as AnalysisResult;
      } else if (remote.ok) {
        // carry through report for rich UI
        result = { ok: true, findings: [...localFindings, ...remote.findings] as any, report: (remote as any).report } as any;
      } else {
        // pass through remote error result so UI can show it
        result = remote;
      }
      try { console.debug('[BG] analyze done', { ok: (result as any).ok, error: (result as any).error }); } catch {}
      await chrome.storage.local.set({ lastResult: result, lastRequest: req, lastReadyAt: Date.now() });
      sendResponse({ ok: true, result });
      return;
    }
    if (msg?.type === 'SETTINGS_UPDATED') {
      // reload client config so new baseUrl/mode/model/apiKey take effect
      try { await client.loadConfig(); } catch {}
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === 'ANALYZE_CLARIFY') {
      const payload = msg.payload as any;
      // prefer calling clarify endpoint with prompt id when available
      if (payload && payload.promptId && Array.isArray(payload.answers)) {
        const promptId = payload.promptId as string;
        const answers = payload.answers as { question_id: string; answer: string }[];
        const remote = await client.clarify(promptId, answers as any);
        if (!remote.ok) { sendResponse({ ok: true, result: remote as any }); return; }
        // map remote response similarly to analyze path
        const remoteData = remote.data as any;
        const localFindings = [] as any[];
        const findings = (remoteData?.report ? [] : []).concat(localFindings);
        const merged = remote.ok ? { ok: true, findings: findings.concat(remoteData?.patches || []) } : remote;
        await chrome.storage.local.set({ lastResult: merged });
        sendResponse({ ok: true, result: merged });
        return;
      }
      // fallback: legacy combinedText flow — analyze the combined text
      const payload2 = msg.payload as { combinedText: string; url?: string };
      const fakeReq: AnalysisRequest = { text: payload2.combinedText, source: 'chatgpt', url: payload2.url || '', ts: Date.now() };
      const localFindings = [...runLengthDetector(fakeReq.text), ...runPiiDetector(fakeReq.text)]
        .map(f => ({ severity: f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warn' : 'info', message: f.message }));
      const remote = await client.analyze(fakeReq);
      const merged = remote.ok ? { ok: true, findings: [...localFindings, ...remote.findings] } : remote;
      await chrome.storage.local.set({ lastResult: merged, lastRequest: fakeReq });
      sendResponse({ ok: true, result: merged });
      return;
    }
    sendResponse({ ok: false, error: 'Unknown message' });
  })().catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});


