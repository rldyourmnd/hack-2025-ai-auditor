import type { AnalysisRequest, AnalysisResult, Finding } from './types';
import { getActiveAdapter, ChatGPTAdapter } from '@extensions/adapters';
import { scanFilesLocally, aggregateMaxSeverity } from './content_pii_guard';
import { showPiiModal } from './ui/pii_modal';
import { runQualityPatterns, type InlinePatternMatch } from '@extensions/core/patterns/quality';

const getAdapter = () => getActiveAdapter() ?? ChatGPTAdapter;
// Avoid importing shared messaging to prevent Rollup from creating a shared chunk for content script
const MSG = { ANALYZE_PROMPT: 'ANALYZE_PROMPT' } as const;
const OVERLAY_ENABLED = true;
const LOG_PREFIX = 'AI Auditor:';
const DEBUG = false;
const IDS = { btn: '__ai_auditor_btn__', toast: '__ai_auditor_toast__', style: '__ai_auditor_style__', panel: '__ai_auditor_panel__' } as const;
const INLINE_IDS = { overlay: '__ai_auditor_hl_overlay__' } as const;

// Unified settings cache sourced from settings object only
type LightSettings = { blockOnHighRisk: boolean; piiGuardEnabled: boolean; flags?: { enableInlineHints?: boolean; enabledSites?: string[] } };
let cachedSettings: LightSettings = { blockOnHighRisk: false, piiGuardEnabled: true };

// Dedup recent file events (signature -> timestamp) to avoid double-processing
const recentFileEventSignatures: Map<string, number> = new Map();
const FILE_EVENT_DEDUP_MS = 1200; // ms

function makeFilesSignature(files: File[]) {
  try {
    // Use only stable file properties (name:size) so signatures match across
    // native events and page-inject reposts where target/uid differ.
    const parts = files.map((f) => `${f.name}:${f.size}:${f.lastModified || 0}`).sort();
    return parts.join('|');
  } catch (e) {
    return String(Date.now());
  }
}

// WeakMap to track seen File objects in-memory to dedupe across event types
const recentFileObjects: WeakMap<File, number> = new WeakMap();
// Store approved File objects per signature so we can reliably re-inject exact files on Allow
const approvedFiles: Map<string, File[]> = new Map();

// Try to remove visible file preview UI items on the page that contain the file name.
// This is heuristic: we look for nodes whose textContent includes the filename and
// attempt to click nearby close buttons or remove the container element.
function removeFilePreviewsByName(names: string[]) {
  try {
    const all = Array.from(document.querySelectorAll('div,span,label,button')) as Element[];
    for (const name of names) {
      const lower = name.toLowerCase();
      for (const node of all) {
        try {
          const text = (node.textContent || '').trim().toLowerCase();
          if (!text || text.indexOf(lower) === -1) continue;

          // Try to find a close/remove button within the node or its ancestors
          const closeBtn = (node.querySelector && node.querySelector('[aria-label*="remove"], [aria-label*="close"], button[title*="remove"], button[title*="close"]')) as HTMLElement | null
            || (node.closest && node.closest('.file-preview, .uploaded-file, .attachment, [data-file]')?.querySelector('[aria-label*="remove"], [aria-label*="close"], button[title*="remove"], button[title*="close"]') as HTMLElement | null);
          if (closeBtn) {
            try { closeBtn.click(); } catch {}
            try { closeBtn.remove(); } catch {}
            continue;
          }

          // Remove containing preview element or node itself
          const container = node.closest ? node.closest('.file-preview, .uploaded-file, .attachment, [data-file]') : null;
          if (container && container.parentElement) {
            try { container.remove(); } catch {}
            continue;
          }
          try { node.remove(); } catch {}
        } catch (e) { continue; }
      }
    }
  } catch (e) {}
}
async function loadSettings() {
  return new Promise<LightSettings>((resolve) => {
    try {
      chrome.storage.local.get(['settings'], (res) => {
        const s = (res?.settings || {}) as any;
        cachedSettings = {
          blockOnHighRisk: typeof s.blockOnHighRisk === 'boolean' ? s.blockOnHighRisk : false,
          piiGuardEnabled: typeof s.piiGuardEnabled === 'boolean' ? s.piiGuardEnabled : true,
          flags: s.flags || {},
        };
        resolve(cachedSettings);
      });
    } catch (err) { resolve(cachedSettings); }
  });
}

// lightweight masking helpers (kept in content script to avoid importing core)
const _emailRe = /[\w.-]+@[\w.-]+\.[A-Za-z]{2,6}/g;
const _phoneRe = /(?:\+\d{1,3}[ -]?)?\d{10,14}/g;
function maskPii(text: string) {
  let replaced = text.replace(_emailRe, (m) => `[redacted-email:${m.slice(0,4)}]`);
  replaced = replaced.replace(_phoneRe, (m) => `[redacted-phone:${m.slice(-4)}]`);
  return replaced;
}

// intercept send flow state
let allowProgrammaticSend = false;

function markSendAllowedTemporarily(btn: HTMLButtonElement) {
  try { btn.setAttribute('data-ai-auditor-allow', '1'); } catch {}
  setTimeout(() => { try { btn.removeAttribute('data-ai-auditor-allow'); } catch {} }, 5000);
}

function isProgrammaticAllowed(btn: HTMLButtonElement) {
  try { return btn.getAttribute('data-ai-auditor-allow') === '1'; } catch { return false; }
}

// ---- UI + page-level blocking helpers ----
let _blockedListeners: Array<{ ev: string; fn: EventListenerOrEventListenerObject; opts?: any }> = [];
let _uiBlocked = false;
let _globalUnblockTimer: number | undefined;
let _popstateHandler: ((e: Event) => void) | null = null;
let _visibilityHandler: ((e: Event) => void) | null = null;
let _blockedInputs: Array<{ el: Element; prevReadOnly?: boolean | null; prevContentEditable?: string | null }> = [];
function applyUiBlock() {
  try {
    if (_uiBlocked) return;
    _uiBlocked = true;
    // disable likely send buttons near adapter anchor
    const adapter = getAdapter();
    const sendBtn = adapter && adapter.findSendButton ? adapter.findSendButton() : null;
    const buttons = Array.from(document.querySelectorAll('button,input[type=submit]')) as HTMLElement[];
    for (const b of buttons) {
      try {
        // skip any controls inside our own UI/modal to keep them interactive
        try { if (b.closest && (b.closest('#__ai_auditor_override__') || b.closest('#' + IDS.panel) || b.closest('#' + INLINE_IDS.overlay))) continue; } catch {}
        // persist previous state
        b.setAttribute('data-ai-prev-disabled', String(Boolean((b as any).disabled)));
        const prevAria = b.getAttribute('aria-disabled');
        if (prevAria !== null) b.setAttribute('data-ai-prev-aria-disabled', prevAria);
        const prevLabel = b.getAttribute('aria-label');
        if (prevLabel !== null) b.setAttribute('data-ai-prev-aria-label', prevLabel);
        const prevTitle = b.getAttribute('title');
        if (prevTitle !== null) b.setAttribute('data-ai-prev-title', prevTitle);
        // apply blocked state and visual cue
        (b as any).disabled = true;
        try { b.setAttribute('aria-disabled', 'true'); } catch {}
        try { b.setAttribute('aria-label', 'Sending blocked by AI Auditor — review findings'); } catch {}
        try { b.setAttribute('title', 'Sending blocked by AI Auditor — review findings'); } catch {}
        b.classList.add('__ai_auditor_blocked');
        // add subtle overlay marker on primary send button
        if (sendBtn && (b === sendBtn || (typeof (sendBtn as any).contains === 'function' && (sendBtn as any).contains(b)))) {
          try {
            const ov = document.createElement('div');
            ov.id = '__ai_auditor_block_overlay__';
            ov.textContent = 'Blocked';
            Object.assign(ov.style, { position: 'fixed', pointerEvents: 'none', background: 'rgba(220,38,38,0.9)', color: '#fff', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', zIndex: '2147483650' } as CSSStyleDeclaration);
            document.body.appendChild(ov);
            // position near sendBtn
            try {
              const r = (sendBtn as HTMLElement).getBoundingClientRect();
              ov.style.left = Math.max(8, Math.round(r.right + 8)) + 'px';
              ov.style.top = Math.max(8, Math.round(r.top)) + 'px';
            } catch {}
          } catch {}
        }
      } catch {}
    }

    const isEventInsideOurUi = (e: Event) => {
      try {
        // prefer composedPath for shadow DOM safety
        if ((e as any).composedPath && typeof (e as any).composedPath === 'function') {
          const path = (e as any).composedPath();
          for (const p of path) {
            try {
              if (!p) continue;
              if (p instanceof Element) {
                if (p.closest && p.closest('#__ai_auditor_override__')) return true;
                if (p.closest && p.closest('#' + IDS.panel)) return true;
                if (p.closest && p.closest('#' + INLINE_IDS.overlay)) return true;
              }
            } catch {}
          }
        } else {
          // fallback: walk up parent nodes from the event target (handles Text nodes)
          let node: Node | null = (e.target as Node) || null;
          while (node) {
            try {
              if (node instanceof Element) {
                if (node.closest && node.closest('#__ai_auditor_override__')) return true;
                if (node.closest && node.closest('#' + IDS.panel)) return true;
                if (node.closest && node.closest('#' + INLINE_IDS.overlay)) return true;
              }
              node = node.parentNode;
            } catch { break; }
          }
        }
      } catch {}
      return false;
    };

    const submitBlock = (e: Event) => { try { if (isEventInsideOurUi(e)) return; e.preventDefault(); e.stopImmediatePropagation(); } catch {} };
    const clickBlock = (e: Event) => { try { if (isEventInsideOurUi(e)) return; const t = e.target as Element | null; if (!t) return; const btn = (t.closest && t.closest('button,input[type=submit]')) as HTMLElement | null; if (btn) { e.preventDefault(); e.stopImmediatePropagation(); } } catch {} };
    const keyBlock = (e: Event) => {
      try {
        if (isEventInsideOurUi(e)) return;
        const ke = e as KeyboardEvent;
        const active = document.activeElement;
        // only block enter/ctrl+enter when focus is in the adapter input
        const adapterInput = adapter && adapter.findInput ? adapter.findInput() : null;
        if (!adapterInput) return;
        if (active === adapterInput || (adapterInput.contains && adapterInput.contains(active as Node))) {
          if ((ke.ctrlKey || ke.metaKey) && ke.key && ke.key.toLowerCase() === 'enter') { ke.preventDefault(); ke.stopImmediatePropagation(); }
          if (ke.key === 'Enter' && active instanceof HTMLTextAreaElement) { ke.preventDefault(); ke.stopImmediatePropagation(); }
        }
      } catch {}
    };
    const keyUpBlock = (e: Event) => { try { if (isEventInsideOurUi(e)) return; const ke = e as KeyboardEvent; if (ke.key && ke.key.toLowerCase() === 'enter') { ke.preventDefault(); ke.stopImmediatePropagation(); } } catch {} };

    document.addEventListener('submit', submitBlock, true);
    document.addEventListener('click', clickBlock, true);
    document.addEventListener('keydown', keyBlock, true);
    document.addEventListener('keyup', keyUpBlock, true);
    _blockedListeners.push({ ev: 'submit', fn: submitBlock, opts: true }, { ev: 'click', fn: clickBlock, opts: true }, { ev: 'keydown', fn: keyBlock, opts: true }, { ev: 'keyup', fn: keyUpBlock, opts: true });

    // notify page-inject to patch network APIs
    try { window.postMessage({ __ai_auditor_control: 'block_sends' }, '*'); } catch {}
    // add SPA/navigation/visibility listeners to ensure we unblock on route change
    try {
      _popstateHandler = () => { try { removeUiBlock(); } catch {} };
      window.addEventListener('popstate', _popstateHandler as any, true);
      _visibilityHandler = () => { if (document.visibilityState === 'hidden') { try { removeUiBlock(); } catch {} } };
      document.addEventListener('visibilitychange', _visibilityHandler as any, true);
    } catch {}
    // global auto-unblock as an extra safety (30s)
    try { if (_globalUnblockTimer) clearTimeout(_globalUnblockTimer as any); _globalUnblockTimer = (setTimeout(() => { try { removeUiBlock(); } catch {} }, 30000) as unknown) as number; } catch {}
    // additionally set adapter input(s) to readonly/contentEditable=false to prevent Enter-based sends
    try {
      const adapterInput = adapter && adapter.findInput ? adapter.findInput() : null;
      if (adapterInput) {
        try {
          // store previous state
          const prevReadOnly = (adapterInput as HTMLInputElement).readOnly === undefined ? null : !!(adapterInput as HTMLInputElement).readOnly;
          const prevContentEditable = (adapterInput as Element).getAttribute ? (adapterInput as Element).getAttribute('contenteditable') : null;
          _blockedInputs.push({ el: adapterInput as Element, prevReadOnly, prevContentEditable });
          // apply blocking
          try { if ((adapterInput as any).tagName && (adapterInput as any).tagName.toLowerCase() === 'textarea') (adapterInput as HTMLTextAreaElement).readOnly = true; } catch {}
          try { if ((adapterInput as Element).setAttribute) (adapterInput as Element).setAttribute('contenteditable', 'false'); } catch {}
          try { (adapterInput as HTMLElement).blur(); } catch {}
        } catch {}
      }
    } catch {}
  } catch (e) {}
}

function removeUiBlock() {
  try {
    if (!_uiBlocked) return;
    _uiBlocked = false;
    const buttons = Array.from(document.querySelectorAll('button.__ai_auditor_blocked,input.__ai_auditor_blocked')) as HTMLElement[];
    for (const b of buttons) {
      try {
        const prev = b.getAttribute('data-ai-prev-disabled');
        (b as any).disabled = prev === 'true';
        // restore aria/title
        const prevAria = b.getAttribute('data-ai-prev-aria-disabled');
        if (prevAria !== null) { try { b.setAttribute('aria-disabled', prevAria); } catch {} b.removeAttribute('data-ai-prev-aria-disabled'); } else { try { b.removeAttribute('aria-disabled'); } catch {} }
        const prevLabel = b.getAttribute('data-ai-prev-aria-label');
        if (prevLabel !== null) { try { b.setAttribute('aria-label', prevLabel); } catch {} b.removeAttribute('data-ai-prev-aria-label'); } else { try { b.removeAttribute('aria-label'); } catch {} }
        const prevTitle = b.getAttribute('data-ai-prev-title');
        if (prevTitle !== null) { try { b.setAttribute('title', prevTitle); } catch {} b.removeAttribute('data-ai-prev-title'); } else { try { b.removeAttribute('title'); } catch {} }
        b.classList.remove('__ai_auditor_blocked');
        b.removeAttribute('data-ai-prev-disabled');
      } catch {}
    }
    try { const ov = document.getElementById('__ai_auditor_block_overlay__'); if (ov) ov.remove(); } catch {}
    for (const rec of _blockedListeners) {
      try { document.removeEventListener(rec.ev as any, rec.fn as any, rec.opts); } catch {}
    }
    _blockedListeners = [];
    try { window.postMessage({ __ai_auditor_control: 'unblock_sends' }, '*'); } catch {}
    // restore adapter inputs readonly/contentEditable
    try {
      for (const b of _blockedInputs) {
        try {
          if (b.el) {
            try { if (typeof b.prevReadOnly === 'boolean' && (b.el as HTMLTextAreaElement).readOnly !== undefined) (b.el as HTMLTextAreaElement).readOnly = !!b.prevReadOnly; } catch {}
            try { if (b.prevContentEditable === null) (b.el as Element).removeAttribute('contenteditable'); else (b.el as Element).setAttribute('contenteditable', String(b.prevContentEditable)); } catch {}
          }
        } catch {}
      }
    } catch {}
    _blockedInputs = [];
    try { if (_popstateHandler) { window.removeEventListener('popstate', _popstateHandler as any, true); _popstateHandler = null; } } catch {}
    try { if (_visibilityHandler) { document.removeEventListener('visibilitychange', _visibilityHandler as any, true); _visibilityHandler = null; } } catch {}
    try { if (_globalUnblockTimer) { clearTimeout(_globalUnblockTimer as any); _globalUnblockTimer = undefined; } } catch {}
  } catch (e) {}
}

// Safe sendMessage wrapper: content scripts may run in environments where
// `chrome.runtime` is not available (e.g., injected into page context).
async function sendMessageToBg(msg: any) {
  // Robust sendMessage with a small retry on transient 'Extension context invalidated' errors.
  const maxRetries = 3;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        try { console.warn('[Content] runtime.sendMessage unavailable'); } catch {}
        return null;
      }
      const resp = await new Promise<any>((resolve) => {
        try {
          chrome.runtime.sendMessage(msg, (r: any) => {
            try {
              if (chrome.runtime?.lastError) {
                // bubble lastError text for handling
                return resolve({ __error: String(chrome.runtime.lastError?.message || chrome.runtime.lastError) });
              }
            } catch {}
            resolve(r ?? null);
          });
        } catch (e) { resolve({ __error: String((e as any)?.message || String(e)) }); }
      });
      if (resp && typeof resp === 'object' && resp.__error) {
        const msgText = String(resp.__error);
        // transient invalidation -> retry
        if (/Extension context invalidated/i.test(msgText) && attempt < maxRetries - 1) {
          try { console.warn('[Content] sendMessage transient error, retrying...', msgText); } catch {}
          await wait(250 * (attempt + 1));
          continue;
        }
        try { console.warn('[Content] sendMessage lastError', msgText); } catch {}
        return null;
      }
      return resp;
    } catch (err) {
      try { console.error('[Content] sendMessage exception', err); } catch {}
      // retry briefly
      await wait(200);
      continue;
    }
  }
  return null;
}

async function directAnalyzeViaFetch(text: string): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const settings = await new Promise<any>((resolve) => {
      try { chrome.storage.local.get('settings', (r) => resolve(r?.settings ?? null)); } catch { resolve(null); }
    });
    const baseUrl = (settings?.baseUrl || '').replace(/\/$/, '');
    if (!baseUrl) return { ok: false, error: 'no_base_url' };
    const url = baseUrl + '/analyze';
    const body = {
      inline_prompt: text,
      model: settings?.model || 'gpt-5-nano',
      options: { format_type: 'auto', language: null, metadata: {}, include_entropy: true, include_clarify: true, include_patches: true },
    } as const;
    const headers: Record<string, string> = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
    if (settings?.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;
    const controller = new AbortController();
    const to = window.setTimeout(() => { try { controller.abort(); console.warn('[Content] direct fetch abort (timeout)'); } catch {} }, 120000);
    try { console.debug('[Content] direct analyze POST', { url }); } catch {}
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    window.clearTimeout(to);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return { ok: false, error: `http_${resp.status}: ${txt}` };
    }
    const data = await resp.json().catch(() => null);
    if (!data) return { ok: false, error: 'invalid_json' };
    return { ok: true, result: { findings: [], report: data.report } };
  } catch (err: any) {
    try { console.error('[Content] direct analyze error', err); } catch {}
    return { ok: false, error: String(err?.message || err) };
  }
}


function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t as any);
    t = setTimeout(() => fn(...args), ms) as any;
  };
}

function ensureStyles() {
  if (document.getElementById(IDS.style)) return;
  const style = document.createElement('style');
  style.id = IDS.style;
  style.textContent = `
    #${IDS.btn}{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:10px;border:1px solid rgba(0,0,0,.15);background:linear-gradient(135deg,#0bd1a3,#14f2b8);color:#021b1b;box-shadow:0 6px 16px rgba(20,242,184,.25);font:500 12px/1.2 system-ui,sans-serif;cursor:pointer}
    #${IDS.btn}:hover{filter:brightness(1.05);box-shadow:0 8px 22px rgba(20,242,184,.35)}
    #${IDS.toast}{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:.5rem .75rem;border-radius:10px;background:rgba(0,0,0,.85);color:#fff;font:500 12px/1 system-ui,sans-serif;opacity:0;transition:.18s;z-index:2147483647}
    #${IDS.toast}.show{opacity:1}
    #${IDS.toast}[data-kind="err"]{background:rgba(200,0,0,.85)}
    /* Ensure our panel and details drawer always use readable colors (override site styles) */
    #${IDS.panel}, #${IDS.panel} * { color: #111 !important; }
    #__ai_auditor_details__, #__ai_auditor_details__ * { color: #111 !important; }
    #${IDS.panel}{position:fixed;top:16px;right:16px;width:360px;max-height:60vh;overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,.1);z-index:2147483647;font:500 12px/1.4 system-ui,sans-serif}
    #${IDS.panel} .hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #eee}
    #${IDS.panel} .title{font-weight:600;font-size:12px}
    #${IDS.panel} .close{border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;color:#111}
    #${IDS.panel} button{padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);background:#f3f4f6;cursor:pointer;font:500 12px/1 system-ui,sans-serif}
    #${IDS.panel} button:hover{filter:brightness(0.98)}
    #${IDS.panel} .clarify{background:#e0f2fe;color:#0369a1;border-color:rgba(3,105,161,0.08)}
    #${IDS.panel} .rerun{background:#eef2ff;color:#3730a3;border-color:rgba(55,48,163,0.06)}
    #${IDS.panel} .apply{background:#f0fdf4;color:#166534;border-color:rgba(22,101,52,0.06)}
    #${IDS.panel} ul{list-style:disc;margin:8px 16px;padding-left:16px}
    #${IDS.panel} li{margin:4px 0}
    #${IDS.panel} .sev-info{color:#2563eb}
    #${IDS.panel} .sev-warn{color:#d97706}
    #${IDS.panel} .sev-error{color:#dc2626}
    #${IDS.panel} .raw{margin:8px 12px 12px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;max-height:220px;overflow:auto;white-space:pre-wrap;font:12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;color:#111827}
    #${IDS.panel}__clarify button,#__close_clarify__{border-radius:6px;padding:6px 8px;background:#f3f4f6;border:1px solid rgba(0,0,0,0.06);cursor:pointer;color:#111}
    /* Inline hints */
    .ai-auditor-hl-overlay{position:absolute;inset:auto auto auto auto;pointer-events:none;white-space:pre-wrap;overflow:hidden;color:transparent;z-index:2147483000}
    .ai-auditor-hl-span{border-radius:3px;padding:0 .5px}
    .ai-auditor-hl-span.info{background:rgba(37,99,235,.14)}
    .ai-auditor-hl-span.warn{background:rgba(217,119,6,.18)}
    .ai-auditor-hl-span.error{background:rgba(220,38,38,.2)}
    /* Floating Loader */
    #__ai_auditor_loader__{position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:2147483648}
    #__ai_auditor_loader__ .__spin{width:20px;height:20px;border:3px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:__ai_spin 1s linear infinite}
    @keyframes __ai_spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    /* Audit button spinner */
    #${IDS.btn}[data-loading="1"]{opacity:.85;cursor:grab}
    #${IDS.btn}[data-loading="1"] .__ai_spinner{width:14px;height:14px;border:2px solid rgba(0,0,0,.15);border-top-color:#021b1b;border-radius:50%;animation:__ai_spin .8s linear infinite}
  `;
  document.head.appendChild(style);
}

// ----- Inline hints (M8) -----
type UiSev = 'info' | 'warn' | 'error';
function escapeHtml(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}
function mapInlineSeverityToUi(sev: 'low' | 'medium' | 'high'): UiSev { return sev === 'high' ? 'error' : sev === 'medium' ? 'warn' : 'info'; }

function buildHtmlWithHighlights(text: string, matches: InlinePatternMatch[]): string {
  if (!matches.length) return escapeHtml(text);
  const parts: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    const s = Math.max(0, Math.min(text.length, m.start));
    const e = Math.max(s, Math.min(text.length, m.end));
    if (s > cursor) parts.push(escapeHtml(text.slice(cursor, s)));
    const cls = mapInlineSeverityToUi(m.severity);
    parts.push(`<span class="ai-auditor-hl-span ${cls}">${escapeHtml(text.slice(s, e))}</span>`);
    cursor = e;
  }
  if (cursor < text.length) parts.push(escapeHtml(text.slice(cursor)));
  return parts.join('');
}

function computeContentBoxRect(el: HTMLElement): { left: number; top: number; width: number; height: number; padLeft: number; padTop: number } {
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const bl = parseFloat(cs.borderLeftWidth || '0') || 0;
  const bt = parseFloat(cs.borderTopWidth || '0') || 0;
  const br = parseFloat(cs.borderRightWidth || '0') || 0;
  const bb = parseFloat(cs.borderBottomWidth || '0') || 0;
  const pl = parseFloat(cs.paddingLeft || '0') || 0;
  const pt = parseFloat(cs.paddingTop || '0') || 0;
  return {
    left: rect.left + bl,
    top: rect.top + bt,
    width: Math.max(0, rect.width - bl - br),
    height: Math.max(0, rect.height - bt - bb),
    padLeft: pl,
    padTop: pt,
  };
}

function createInlineOverlayFor(el: HTMLElement): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'ai-auditor-hl-overlay';
  overlay.id = INLINE_IDS.overlay;
  const cs = getComputedStyle(el);
  // mirror key typography and spacing to align line wrapping
  overlay.style.position = 'fixed';
  overlay.style.whiteSpace = 'pre-wrap';
  overlay.style.overflow = 'hidden';
  overlay.style.pointerEvents = 'none';
  overlay.style.font = cs.font;
  overlay.style.fontFamily = cs.fontFamily;
  overlay.style.fontSize = cs.fontSize;
  overlay.style.lineHeight = cs.lineHeight;
  overlay.style.letterSpacing = cs.letterSpacing;
  overlay.style.wordWrap = 'break-word';
  overlay.style.background = 'transparent';
  overlay.style.color = 'transparent';
  document.body.appendChild(overlay);
  return overlay;
}

function syncOverlayGeometry(el: HTMLElement, overlay: HTMLDivElement) {
  const box = computeContentBoxRect(el);
  overlay.style.left = `${Math.round(box.left)}px`;
  overlay.style.top = `${Math.round(box.top)}px`;
  overlay.style.width = `${Math.round(box.width)}px`;
  overlay.style.height = `${Math.round(box.height)}px`;
  // account for inner scroll of textarea/contenteditable
  const sl = (el as any).scrollLeft ? Number((el as any).scrollLeft) : 0;
  const st = (el as any).scrollTop ? Number((el as any).scrollTop) : 0;
  // include padding so highlighting aligns with text start
  const tx = -sl + box.padLeft;
  const ty = -st + box.padTop;
  overlay.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
}

function createHighlighter(el: HTMLElement) {
  let disposed = false;
  const overlay = createInlineOverlayFor(el);
  const updateOverlayHtml = () => {
    if (disposed) return;
    const text = el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
    const found = runQualityPatterns(text);
    const html = buildHtmlWithHighlights(text, found);
    overlay.innerHTML = html;
    syncOverlayGeometry(el, overlay);
  };
  const onInput = () => updateOverlayHtml();
  const onScroll = () => syncOverlayGeometry(el, overlay);
  const onResize = () => syncOverlayGeometry(el, overlay);
  el.addEventListener('input', onInput);
  el.addEventListener('scroll', onScroll, { passive: true } as any);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onResize, { passive: true } as any);
  // initial
  updateOverlayHtml();
  return {
    update: updateOverlayHtml,
    dispose() {
      if (disposed) return;
      disposed = true;
      try { el.removeEventListener('input', onInput); } catch {}
      try { el.removeEventListener('scroll', onScroll as any); } catch {}
      try { window.removeEventListener('resize', onResize); } catch {}
      try { window.removeEventListener('scroll', onResize as any); } catch {}
      try { overlay.remove(); } catch {}
    },
  };
}

let inlineManager: { update: () => void; dispose: () => void } | null = null;
let inlineElement: HTMLElement | null = null;
async function isInlineHintsEnabled(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['settings'], (r) => {
        const flags = r?.settings?.flags || {};
        const v = typeof flags.enableInlineHints === 'boolean' ? flags.enableInlineHints : false;
        resolve(Boolean(v));
      });
    } catch { resolve(false); }
  });
}

async function setupInlineHints(currentAdapter: ReturnType<typeof getActiveAdapter>) {
  const enabled = await isInlineHintsEnabled();
  if (!enabled) { if (inlineManager) { inlineManager.dispose(); inlineManager = null; } return; }
  const adapter = currentAdapter;
  if (!adapter) { if (inlineManager) { inlineManager.dispose(); inlineManager = null; } return; }
  const input = adapter.findInput();
  if (!input) { if (inlineManager) { inlineManager.dispose(); inlineManager = null; inlineElement = null; } return; }
  const inputEl = input as HTMLElement;
  if (inlineElement && inlineElement === inputEl && document.getElementById(INLINE_IDS.overlay)) {
    // already attached; just resync geometry
    syncOverlayGeometry(inputEl, document.getElementById(INLINE_IDS.overlay) as HTMLDivElement);
    inlineManager?.update();
    return;
  }
  // Different target: dispose previous and create new
  if (inlineManager) { try { inlineManager.dispose(); } catch {} }
  inlineManager = createHighlighter(inputEl);
  inlineElement = inputEl;
}

function disposeInlineHints() {
  try { inlineManager?.dispose(); } catch {}
  inlineManager = null;
  inlineElement = null;
  try { const ex = document.getElementById(INLINE_IDS.overlay); if (ex) ex.remove(); } catch {}
}

function attachHotkeyOnce() {
  const g = window as any;
  if (g.__aiAuditorHotkeyAttached) return;
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key.toLowerCase() === 'a')) {
      const adapter = getActiveAdapter();
      if (!adapter) return;
      const input = adapter.findInput();
      const focused = document.activeElement as Element | null;
      if (input && (focused === input || (focused && input.contains(focused)))) {
        e.preventDefault();
        analyzeAndMaybeSend();
      }
    }
  }, { capture: true });
  g.__aiAuditorHotkeyAttached = true;
}

function toast(message: string, kind: 'ok' | 'err' = 'ok') {
  let t = document.getElementById(IDS.toast);
  if (!t) { t = document.createElement('div'); t.id = IDS.toast; document.body.appendChild(t); }
  t.textContent = message; t.setAttribute('data-kind', kind); t.classList.add('show');
  setTimeout(() => t && t.classList.remove('show'), 2000);
}

function showLoader() {
  try {
    let el = document.getElementById('__ai_auditor_loader__') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = '__ai_auditor_loader__';
      el.innerHTML = `<div class="__spin" aria-hidden="true"></div>`;
      document.body.appendChild(el);
    }
  } catch (err) { /* ignore */ }
}

function hideLoader() {
  try { const el = document.getElementById('__ai_auditor_loader__'); if (el) el.remove(); } catch (err) { /* ignore */ }
}

function removeOverlay() {
  const panel = document.getElementById(IDS.panel);
  if (panel) panel.remove();
}

function renderOverlay(rawText: string, findings: Finding[], error?: string, extras?: { report?: any }) {
  removeOverlay();
  const panel = document.createElement('div');
  panel.id = IDS.panel;
  panel.innerHTML = `
    <div class="hdr" style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:8px"><span class="title">AI Auditor • Findings: ${findings.length}${error ? ' (error)' : ''}</span></div><div style="display:flex;gap:6px;align-items:center"><button class="help" title="What do the bars mean?" type="button">?</button><button class="close" aria-label="Close">×</button></div></div>
    <div class="raw" aria-label="Prompt text"></div>
    <div class="metrics" style="padding:8px 12px;display:flex;gap:8px;flex-wrap:wrap"></div>
    <div class="charts" style="padding:6px 12px 0"></div>
    <ul></ul>
    <div style="display:flex;gap:8px;padding:8px 12px;border-top:1px solid #f1f1f1;justify-content:flex-end">
      <button class="clarify" type="button">Clarify</button>
      <button class="details" type="button">Details</button>
      <button class="ok" type="button">OK</button>
    </div>
  `;
  const raw = panel.querySelector('.raw')! as HTMLDivElement;
  raw.textContent = rawText;
  const ul = panel.querySelector('ul')!;
  const metricsEl = panel.querySelector('.metrics') as HTMLDivElement;
  const chartsEl = panel.querySelector('.charts') as HTMLDivElement;
  // compute simple metrics
  const len = rawText.length;
  const bySeverity = { info: 0, warn: 0, error: 0 } as Record<string, number>;
  findings.forEach(f => { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; });
  const makeBadge = (txt: string, cls = '') => {
    const b = document.createElement('span');
    b.textContent = txt;
    b.style.padding = '4px 8px';
    b.style.borderRadius = '999px';
    b.style.fontSize = '12px';
    b.style.background = cls === 'err' ? '#fee2e2' : cls === 'warn' ? '#fff7ed' : '#eef2ff';
    b.style.color = cls === 'err' ? '#991b1b' : cls === 'warn' ? '#92400e' : '#1e40af';
    b.style.border = '1px solid rgba(0,0,0,0.04)';
    return b;
  };
  metricsEl.appendChild(makeBadge(`Findings: ${findings.length}`));
  metricsEl.appendChild(makeBadge(`High: ${bySeverity.error}`, 'err'));
  metricsEl.appendChild(makeBadge(`Medium: ${bySeverity.warn}`, 'warn'));
  metricsEl.appendChild(makeBadge(`Info: ${bySeverity.info}`));
  metricsEl.appendChild(makeBadge(`Len: ${len}`));
  // visual metric bars if report present
  try {
    const report = extras?.report || null;
    if (report) {
      const scoreRaw = typeof report?.judge_score?.score === 'number' ? report.judge_score.score : NaN;
      const entRaw = Number(report?.semantic_entropy?.entropy);
      const complexityRaw = typeof report?.complexity_score === 'number' ? report.complexity_score : NaN;
      const mkBar = (label: string, val: number, min: number, max: number, colorA: string, colorB: string, help: string, sectors = 5) => {
        const pct = Math.max(min, Math.min(max, val)) / (max - min) * 100;
        const wrap = document.createElement('div');
        wrap.style.margin = '6px 0 10px';
        wrap.style.maxWidth = '280px';
        const segmentsHtml = Array.from({ length: sectors }).map(() => `<div style="flex:1;border-right:1px solid rgba(0,0,0,0.06)"></div>`).join('');
        wrap.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;font:12px/1 system-ui;margin-bottom:4px"><span>${label}</span><div style="display:flex;align-items:center;gap:6px"><span>${val.toFixed(2)}</span><button class="minihelp" title="What is this?" style="padding:2px 6px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;cursor:pointer">?</button></div></div>
          <div style="height:10px;border-radius:8px;background:#f3f4f6;position:relative;overflow:hidden">
            <div style="display:flex;height:100%">${segmentsHtml}</div>
            <div aria-hidden="true" style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:linear-gradient(90deg, ${colorA}, ${colorB});border-radius:8px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font:11px/1 system-ui;margin-top:4px;color:#374151"><span>${min}</span><span>${max}</span></div>
        `;
        chartsEl.appendChild(wrap);
        const btn = wrap.querySelector('.minihelp') as HTMLButtonElement | null;
        btn?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const tip = document.createElement('div');
          Object.assign(tip.style, { position: 'fixed', right: '24px', top: '24px', maxWidth: '320px', padding: '8px 10px', background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: '2147483650', font: '12px/1.3 system-ui,sans-serif' } as CSSStyleDeclaration);
          tip.textContent = help;
          document.body.appendChild(tip);
          const close = (e: MouseEvent) => { if (!tip.contains(e.target as Node)) { try { tip.remove(); } catch {}; document.removeEventListener('click', close); } };
          setTimeout(() => document.addEventListener('click', close), 0);
        });
      };
      const complexity = isFinite(Number(complexityRaw)) ? Number(complexityRaw) : 0;
      const score = isFinite(Number(scoreRaw)) ? Number(scoreRaw) : 0;
      const ent = isFinite(Number(entRaw)) ? Number(entRaw) : 0;
      // Always render three bars in the same order
      mkBar('Complexity (0–10)', complexity, 0, 10, '#a78bfa', '#7c3aed', 'Complexity estimates how many steps, branching and external knowledge the prompt implies (0–10).');
      mkBar('Quality (0–10)', score, 0, 10, '#22c55e', '#f59e0b', 'Quality is a holistic score (clarity, specificity, feasibility).');
      mkBar('Entropy (0–10)', ent, 0, 10, '#60a5fa', '#3b82f6', 'Semantic entropy (0–10) is normalized from 0–1 × 10 and inversely reflects how many ontologically different answers are plausible.');
      const ctr = (Array.isArray(report?.contradictions) ? report.contradictions.length : 0) as number;
      const trg = (Array.isArray(report?.hallucination_triggers) ? report.hallucination_triggers.length : 0) as number;
      if (ctr || trg) {
        const agg = document.createElement('div');
        agg.style.display = 'flex'; agg.style.gap = '8px'; agg.style.margin = '2px 0 8px';
        agg.appendChild(makeBadge(`Contradictions: ${ctr}`, ctr ? 'warn' : ''));
        agg.appendChild(makeBadge(`Triggers: ${trg}`, trg ? 'warn' : ''));
        chartsEl.appendChild(agg);
      }
    }
  } catch {}
  if (error) {
    const li = document.createElement('li');
    li.className = 'sev-error';
    li.textContent = `[error] ${error}`;
    ul.appendChild(li);
  }
  findings.forEach(f => {
    const li = document.createElement('li');
    li.className = `sev-${f.severity}`;
    li.textContent = `[${f.severity}] ${f.message}`;
    ul.appendChild(li);
  });
  const close = panel.querySelector('.close') as HTMLButtonElement;
  // close button should hide immediately
  close.addEventListener('click', () => panel.remove());
  let hideTimer: number | undefined;
  const scheduleHide = () => {
    if (hideTimer) clearTimeout(hideTimer as any);
    hideTimer = setTimeout(() => panel.remove(), 10000) as any;
  };
  panel.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer as any); hideTimer = undefined; } });
  panel.addEventListener('mouseleave', scheduleHide);
  document.body.appendChild(panel);
  scheduleHide();

  // action buttons
  const clarifyBtn = panel.querySelector('.clarify') as HTMLButtonElement | null;
  const okBtn = panel.querySelector('.ok') as HTMLButtonElement | null;
  clarifyBtn?.addEventListener('click', () => renderClarifyOverlay(rawText));
  okBtn?.addEventListener('click', () => panel.remove());
  const detailsBtn = panel.querySelector('.details') as HTMLButtonElement | null;
  detailsBtn?.addEventListener('click', () => openDetailsOverlay(extras?.report, findings, (extras as any)?.overrideQuestions));

  // help button: show brief explanation modal
  const helpBtn = panel.querySelector('.help') as HTMLButtonElement | null;
  helpBtn?.addEventListener('click', () => {
    const existing = document.getElementById('__ai_auditor_help__');
    if (existing) return;
    const m = document.createElement('div');
    m.id = '__ai_auditor_help__';
    Object.assign(m.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '420px', maxWidth: '90vw', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', zIndex: '2147483650', boxShadow: '0 12px 30px rgba(0,0,0,.12)', color: '#111' } as CSSStyleDeclaration);
    m.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>About the metrics</strong><button id="__ai_auditor_help_close__">×</button></div>
      <div style="font-size:13px;line-height:1.3;color:#374151">
        The bars show the model's computed metrics for the prompt. Each bar is split into sectors for easier visual reference. The left label is the minimum value and the right label is the maximum. Higher filled portion indicates higher metric value. "Quality" is 0–10, "Entropy" is shown on its scale (e.g., 0–2), and "Complexity" is 0–10.
      </div>
    `;
    document.body.appendChild(m);
    (m.querySelector('#__ai_auditor_help_close__') as HTMLButtonElement).addEventListener('click', () => m.remove());
  });
}

function openDetailsOverlay(report: any, findings: Finding[], overrideQuestions?: any[] | null) {
  const existing = document.getElementById('__ai_auditor_details__');
  if (existing) { try { existing.remove(); } catch {} }
  const wrap = document.createElement('div');
  wrap.id = '__ai_auditor_details__';
  Object.assign(wrap.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', background: 'rgba(0,0,0,.35)', zIndex: '2147483648', display: 'flex', alignItems: 'center', justifyContent: 'center' } as CSSStyleDeclaration);
  const modal = document.createElement('div');
  Object.assign(modal.style, { width: '720px', maxWidth: '92vw', maxHeight: '80vh', overflow: 'hidden', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', color: '#111', display: 'flex', flexDirection: 'column' } as CSSStyleDeclaration);
  const tabs = ['Overview','Highlights','Triggers','Patches','Questions','JSON'] as const;
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '8px', padding: '10px', borderBottom: '1px solid #eee', alignItems: 'center', justifyContent: 'space-between' } as CSSStyleDeclaration);
  const left = document.createElement('div'); left.style.display = 'flex'; left.style.gap = '8px';
  tabs.forEach(t => { const b = document.createElement('button'); b.setAttribute('data-tab', t); b.textContent = t; b.type = 'button'; b.setAttribute('data-role', 'tab'); Object.assign(b.style, { padding: '6px 10px', border: '1px solid #eee', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer' } as CSSStyleDeclaration); left.appendChild(b); });
  tabBar.appendChild(left);
  const body = document.createElement('div'); Object.assign(body.style, { padding: '10px', overflow: 'auto', height: 'calc(100% - 46px)' } as CSSStyleDeclaration); body.id = '__ai_auditor_details_body__';
  const footer = document.createElement('div'); Object.assign(footer.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '10px', borderTop: '1px solid #eee' } as CSSStyleDeclaration);
  const backBtn = document.createElement('button'); backBtn.textContent = 'Back'; Object.assign(backBtn.style, { padding: '6px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer' } as CSSStyleDeclaration);
  const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close'; Object.assign(closeBtn.style, { padding: '6px 10px', borderRadius: '8px', border: '1px solid #eee', background: '#fff', cursor: 'pointer' } as CSSStyleDeclaration);
  footer.appendChild(backBtn); footer.appendChild(closeBtn);
  modal.appendChild(tabBar); modal.appendChild(body); modal.appendChild(footer); wrap.appendChild(modal); document.body.appendChild(wrap);
  const bodyEl = body as HTMLDivElement;
  const remove = () => { try { wrap.remove(); } catch {} };
  closeBtn.addEventListener('click', remove);
  backBtn.addEventListener('click', remove);
  const renderOverview = () => {
    const s = [] as string[];
    const score = report?.judge_score?.score;
    const rationale = report?.judge_score?.rationale || '';
    s.push(`<div style="margin-bottom:8px"><strong>Score:</strong> ${typeof score === 'number' ? score : 'N/A'}</div>`);
    if (rationale) s.push(`<div style="white-space:pre-wrap">${escapeHtml(rationale)}</div>`);
    s.push(`<hr/><div><strong>Findings</strong><ul>${findings.map(f=>`<li>[${f.severity}] ${escapeHtml(f.message)}</li>`).join('')}</ul></div>`);
    bodyEl.innerHTML = s.join('');
  };
  const renderHighlights = () => {
    const hs = Array.isArray(report?.highlights) ? report.highlights : [];
    if (!hs.length) { bodyEl.textContent = 'No highlights from the model.'; return; }
    const html = hs.slice(0, 15).map((h:any) => `<div style="margin-bottom:10px"><div><strong>${escapeHtml(h.category || '')}</strong> • ${escapeHtml(h.severity || '')}</div><div style="font:12px/1.2 ui-monospace,monospace;background:#f8fafc;border:1px solid #eee;padding:6px;border-radius:6px;margin:4px 0">${escapeHtml(h.verbatim || '')}</div><div>${escapeHtml(h?.popover?.message || h.reason || '')}</div>${Array.isArray(h?.popover?.missing) ? `<div style="font-size:12px;margin-top:4px;color:#6b7280">Missing: ${h.popover.missing.map((m:string)=>escapeHtml(m)).join(', ')}</div>` : ''}</div>`).join('');
    bodyEl.innerHTML = html;
  };
  const renderTriggers = () => {
    const arr = Array.isArray(report?.hallucination_triggers) ? report.hallucination_triggers : [];
    if (!arr.length) { bodyEl.textContent = 'No triggers.'; return; }
    const html = `<table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;border-bottom:1px solid #eee;padding:6px">Category</th><th style="text-align:left;border-bottom:1px solid #eee;padding:6px">Severity</th><th style="text-align:left;border-bottom:1px solid #eee;padding:6px">Evidence</th></tr></thead><tbody>${arr.map((t:any)=>`<tr><td style="padding:6px;border-bottom:1px solid #f1f5f9">${escapeHtml(t.category)}</td><td style="padding:6px;border-bottom:1px solid #f1f5f9">${escapeHtml(t.severity)}</td><td style="padding:6px;border-bottom:1px solid #f1f5f9">${escapeHtml(t.evidence)}</td></tr>`).join('')}</tbody></table>`;
    bodyEl.innerHTML = html;
  };
  const renderPatches = () => {
    const arr = Array.isArray(report?.patches) ? report.patches : [];
    if (!arr.length) { bodyEl.textContent = 'No patches.'; return; }
    const html = arr.slice(0, 10).map((p:any)=>`<div style="border:1px solid #eee;border-radius:8px;padding:8px;margin-bottom:8px"><div><strong>${escapeHtml(p.category)}</strong> • ${escapeHtml(p.type)}</div><div style="font-size:12px;margin:4px 0">${escapeHtml(p.description || '')}</div><div style="display:flex;gap:8px;margin-top:6px"><button data-apply="${encodeURIComponent(p.after || p.improved || '')}" ${p.type==='risky' ? 'title="Risky change"' : ''}>${p.type==='safe' ? 'Apply' : 'Preview'}</button></div></div>`).join('');
    bodyEl.innerHTML = html;
    bodyEl.querySelectorAll('button[data-apply]').forEach(btn=>{
      btn.addEventListener('click', () => {
        const adapter = getActiveAdapter(); if (!adapter) return;
        const input = adapter.findInput(); if (!input) return;
        const val = decodeURIComponent((btn as HTMLButtonElement).getAttribute('data-apply') || '');
        if (val) adapter.setDraft(input, val);
      });
    });
  };
  const renderQuestions = () => {
    // If override questions provided (from Clarify), show them instead of defaults
    const arr = Array.isArray(overrideQuestions) && overrideQuestions.length
      ? overrideQuestions
      : Array.isArray(report?.global_questions)
        ? report.global_questions
        : Array.isArray(report?.clarify_questions)
          ? report.clarify_questions
          : [];
    if (!arr.length) { bodyEl.textContent = 'No questions.'; return; }
    const html = `<ol>${arr.slice(0,4).map((q:any)=>`<li style="margin:6px 0">${escapeHtml(q.question || '')}</li>`).join('')}</ol>`;
    bodyEl.innerHTML = html;
  };
  const renderJson = () => {
    try { bodyEl.textContent = JSON.stringify(report ?? { findings }, null, 2); bodyEl.style.whiteSpace = 'pre'; bodyEl.style.font='12px/1.3 ui-monospace,monospace'; } catch { bodyEl.textContent = 'Invalid JSON'; }
  };
  const renderers: Record<string, () => void> = { Overview: renderOverview, Highlights: renderHighlights, Triggers: renderTriggers, Patches: renderPatches, Questions: renderQuestions, JSON: renderJson };
  // bind clicks to the buttons we created in this scope
  left.querySelectorAll('button[data-tab]').forEach(btn => btn.addEventListener('click', () => { const tab = (btn as HTMLButtonElement).getAttribute('data-tab')!; (renderers[tab] || renderOverview)(); }));
  renderOverview();
}

function renderClarifyOverlay(originalText: string) {
  // simple modal overlay centered
  const existing = document.getElementById(IDS.panel + '__clarify');
  if (existing) return;
  const modal = document.createElement('div');
  modal.id = IDS.panel + '__clarify';
  Object.assign(modal.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '520px', maxHeight: '70vh', overflow: 'auto', background: '#fff', border:'1px solid #e5e7eb', borderRadius: '10px', padding: '12px', zIndex: '2147483648', boxShadow: '0 12px 30px rgba(0,0,0,.12)', color: '#111' } as CSSStyleDeclaration);
  // enforce readable colors inside the modal to avoid site styles leaking in
  modal.innerHTML = `
    <style>
      #${IDS.panel}__clarify, #${IDS.panel}__clarify * { color: #111 !important; }
      #${IDS.panel}__clarify label { display:block; margin-top:8px; color: #111 !important; }
      #${IDS.panel}__clarify textarea, #${IDS.panel}__clarify input { background: #fff !important; color: #111 !important; border: 1px solid #e5e7eb !important; }
      #${IDS.panel}__clarify button { color: #111 !important; }
    </style>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Clarify prompt</strong><button id="__close_clarify__">×</button></div>
    <label style="font-size:12px">Context (optional)</label>
    <textarea id="clar_ctx" style="width:100%;height:68px;margin-bottom:8px"></textarea>
    <label style="font-size:12px">Goal</label>
    <input id="clar_goal" style="width:100%;margin-bottom:8px" />
    <label style="font-size:12px">Criteria (one per line)</label>
    <textarea id="clar_criteria" style="width:100%;height:68px;margin-bottom:8px"></textarea>
    <label style="font-size:12px">Resources (links/examples)</label>
    <textarea id="clar_res" style="width:100%;height:68px;margin-bottom:12px"></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="clar_back" type="button">Back</button>
      <button id="clar_send" type="button">Send</button>
    </div>
  `;
  document.body.appendChild(modal);
  // ensure any floating loader is hidden when modal is shown
  try { hideLoader(); } catch {}
  (modal.querySelector('#__close_clarify__') as HTMLButtonElement).addEventListener('click', () => modal.remove());
  (modal.querySelector('#clar_back') as HTMLButtonElement).addEventListener('click', () => modal.remove());
  (modal.querySelector('#clar_send') as HTMLButtonElement).addEventListener('click', async () => {
    const ctx = (modal.querySelector('#clar_ctx') as HTMLTextAreaElement).value.trim();
    const goal = (modal.querySelector('#clar_goal') as HTMLInputElement).value.trim();
    const crit = (modal.querySelector('#clar_criteria') as HTMLTextAreaElement).value.trim();
    const res = (modal.querySelector('#clar_res') as HTMLTextAreaElement).value.trim();
    const combined = originalText + '\n\n--- Clarifications ---\n' + [ctx, goal, crit, res].filter(Boolean).join('\n\n');
    modal.remove();
    toast('Sending clarifications...');
    const resp = await sendMessageToBg({ type: 'ANALYZE_CLARIFY', payload: { combinedText: combined, url: location.href } }) as { ok: boolean; result?: { ok: boolean; findings?: any[]; error?: string; report?: any } } | null;
    if (!resp || !resp.ok || !resp.result) return toast('Clarify error', 'err');
    if (resp.result.ok) {
      // If model returned report with alternative questions, pass them to details overlay to replace defaults
      const altQs = (resp.result as any)?.report?.global_questions || [];
      // renderOverlay expects an options object with `report` only; pass altQs via report wrapper
      const reportWrapper = { ...(resp.result as any).report, overrideQuestions: altQs };
      renderOverlay(combined, resp.result.findings || [], undefined, { report: reportWrapper });
    } else {
      renderOverlay(combined, [], resp.result.error);
    }
  });
}

function showOverrideModal(adapter: any, sendBtn: HTMLButtonElement, findings: any[], originalText: string) {
  const existing = document.getElementById('__ai_auditor_override__');
  if (existing) return;
  const modal = document.createElement('div');
  modal.id = '__ai_auditor_override__';
  Object.assign(modal.style, { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '520px', maxHeight: '70vh', overflow: 'auto', background: '#fff', border:'1px solid #e5e7eb', borderRadius: '10px', padding: '12px', zIndex: '2147483648', boxShadow: '0 12px 30px rgba(0,0,0,.12)' } as CSSStyleDeclaration);
  modal.innerHTML = `
    <style>
      #__ai_auditor_override__, #__ai_auditor_override__ * { color: #111 !important; }
      #__ai_auditor_override__ { background: #fff !important; }
      #__ai_auditor_override__ a, #__ai_auditor_override__ button { color: inherit !important; }
      #__ai_auditor_override__ #__close_override__ { font-size: 20px; padding: 6px 10px; border-radius: 6px; }
    </style>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong>Blocked: high-risk findings</strong><button id="__close_override__" aria-label="Close">×</button></div>
    <div style="font-size:12px;margin-bottom:8px">The prompt contains high severity findings and sending is blocked by policy. Review findings below.</div>
    <ul id="__override_list" style="max-height:200px;overflow:auto;margin-bottom:12px"></ul>
  `;
  document.body.appendChild(modal);
  // Apply UI + network blocking so page cannot send while modal is up
  try { applyUiBlock(); } catch {}
  // Auto-unblock after 20s to avoid locking page permanently
  const AUTO_UNBLOCK_MS = 20000;
  let _autoUnblockTimer: number | undefined;
  try { _autoUnblockTimer = (setTimeout(() => { try { removeUiBlock(); } catch {} }, AUTO_UNBLOCK_MS) as unknown) as number; } catch {}
  const ul = modal.querySelector('#__override_list') as HTMLUListElement;
  findings.forEach(f => { const li = document.createElement('li'); li.textContent = `[${f.severity}] ${f.message}`; ul.appendChild(li); });
  // central close to ensure unblock and timer cleanup
  let _closed = false;
  const doClose = () => {
    if (_closed) return; _closed = true;
    try { if (_autoUnblockTimer) clearTimeout(_autoUnblockTimer as any); } catch {}
    try { removeUiBlock(); } catch {}
    try { modal.remove(); } catch {}
  };
  const closeBtnEl = modal.querySelector('#__close_override__') as HTMLButtonElement | null;
  if (closeBtnEl) closeBtnEl.addEventListener('click', () => { try { doClose(); } catch {} });
}

async function analyzeAndMaybeSend() {
  const adapter = getActiveAdapter();
  if (!adapter) return toast('Site not supported', 'err');
  const input = adapter.findInput();
  if (!input) return toast('Input not found', 'err');
  const text = adapter.getDraft(input).trim();
  if (!text) return toast('Nothing to analyze', 'err');
  const req: AnalysisRequest = { text, source: adapter.id, url: location.href, ts: Date.now() };
  try { if (DEBUG) console.log(LOG_PREFIX, 'Captured prompt', { length: text.length, preview: text.slice(0, 200) }); } catch {}
  // First, try to wake up background with a ping
  await sendMessageToBg({ type: 'PING' });
  const res = await sendMessageToBg({ type: MSG.ANALYZE_PROMPT, payload: req }) as { ok: boolean; result?: AnalysisResult } | null;
  if (res === null) {
    // BG unavailable — try direct fetch only if baseUrl configured, otherwise surface a helpful error
    const settings = await new Promise<any>((resolve) => { try { chrome.storage.local.get('settings', (r) => resolve(r?.settings ?? null)); } catch { resolve(null); } });
    if (settings?.baseUrl) {
      const df = await directAnalyzeViaFetch(text);
      if (!df.ok || !df.result) return toast('Analyzer error', 'err');
      const directResult: any = { ok: true, findings: df.result?.findings || [], report: df.result?.report };
      return OVERLAY_ENABLED ? renderOverlay(text, directResult.findings, undefined, { report: directResult.report }) : toast(`Findings: ${directResult.findings.length}`);
    }
    toast('Background analyzer unavailable — open extension options or reload the extension', 'err');
    return;
  }
  if (!res?.ok || !res.result) {
    toast('Analyzer error', 'err');
    return;
  }
  if (res.result.ok) {
    try { showLoader(); } catch {}
    try {
      if (OVERLAY_ENABLED) {
        renderOverlay(text, res.result.findings, undefined, { report: (res.result as any).report });
      } else {
        const issues = res.result.findings.length;
        toast(`Findings: ${issues}`);
      }
    } finally { try { hideLoader(); } catch {} }
  } else {
    try { showLoader(); } catch {}
    try {
      if (OVERLAY_ENABLED) {
        renderOverlay(text, [], res.result.error);
      } else {
        toast(`Error: ${res.result.error}`, 'err');
      }
    } finally { try { hideLoader(); } catch {} }
  }
}


function maybeInjectButton() {
  let already = document.getElementById(IDS.btn);
  const adapter = getActiveAdapter();
  if (!adapter) return;
  // If a button exists but was injected for a different adapter, remove it and continue
  if (already) {
    try {
      if (document.body.dataset.aiAuditorInjected !== adapter.id) {
        already.remove();
        already = null;
        try { delete document.body.dataset.aiAuditorInjected; } catch {}
      } else {
        // button already injected for this adapter; ensure send exists before bailing out
        const sendExisting = adapter.findSendButton();
        if (sendExisting && document.getElementById(IDS.btn)) return; // all good
      }
    } catch {}
  }
  const send = adapter.findSendButton();
  if (!send) return; // cannot inject without anchor
  const btn = document.createElement('button');
  btn.id = IDS.btn;
  btn.type = 'button';
  btn.textContent = 'Audit';
  btn.setAttribute('aria-label', 'Audit prompt');
  // Append to body and position near the real Send button to avoid layout shifts
  document.body.appendChild(btn);
  // apply robust inline styles to avoid site CSS overriding our button
  btn.style.setProperty('position', 'fixed', 'important');
  btn.style.setProperty('z-index', '2147483647', 'important');
  btn.style.setProperty('display', 'inline-flex', 'important');
  btn.style.setProperty('align-items', 'center', 'important');
  btn.style.setProperty('gap', '0.4rem', 'important');
  btn.style.setProperty('padding', '.35rem .6rem', 'important');
  btn.style.setProperty('border-radius', '10px', 'important');
  btn.style.setProperty('border', '1px solid rgba(0,0,0,.15)', 'important');
  btn.style.setProperty('background', 'linear-gradient(135deg,#0bd1a3,#14f2b8)', 'important');
  btn.style.setProperty('color', '#021b1b', 'important');
  btn.style.setProperty('box-shadow', '0 6px 16px rgba(20,242,184,.25)', 'important');
  btn.style.setProperty('font', '500 12px/1.2 system-ui, sans-serif', 'important');
  btn.style.setProperty('cursor', 'pointer', 'important');
  // Apply saved manual position if present; otherwise auto-position
  (async () => {
    const stored = await getStoredButtonPos();
    if (stored && stored.adapterId === adapter.id && stored.manual) {
      // apply stored absolute coords (viewport pixels)
      btn.style.left = `${stored.left}px`;
      btn.style.top = `${stored.top}px`;
      // mark pinned to avoid auto reposition
      btn.setAttribute('data-manual-pinned', '1');
    } else {
      positionButtonNear(send, btn);
    }
    // enable dragging/persistence after initial positioning
    try { makeDraggableAndPersist(btn, adapter.id); } catch {}
  })();
  // Reposition on scroll/resize
  const onR = () => {
    // don't auto-reposition if user manually pinned the button
    if (btn.getAttribute('data-manual-pinned') === '1') return;
    positionButtonNear(send, btn);
  };
  window.addEventListener('resize', onR);
  window.addEventListener('scroll', onR, { passive: true });
  // Observe DOM changes to re-evaluate positioning / remove if send disappears
  // Use debounced observer to avoid thrashing on heavy DOM mutations
  let moTimer: number | undefined;
  const obs = new MutationObserver(() => {
    if (moTimer) clearTimeout(moTimer as any);
    moTimer = setTimeout(() => {
      try {
        if (!document.body.contains(send) || !document.body.contains(btn)) {
          try { btn.remove(); } catch {}
          try { window.removeEventListener('resize', onR); window.removeEventListener('scroll', onR as any); } catch {}
          try { if (document.body.dataset.aiAuditorInjected === adapter.id) delete document.body.dataset.aiAuditorInjected; } catch {}
          obs.disconnect();
        } else {
          if (btn.getAttribute('data-manual-pinned') !== '1') positionButtonNear(send, btn);
        }
      } catch (err) {}
    }, 250) as any;
  });
  obs.observe(document.documentElement, { subtree: true, childList: true });
  // avoid triggering analyze immediately after a drag: wrap click handler
  const onBtnClick = (e: MouseEvent) => {
    try {
      if (btn.getAttribute('data-was-dragged') === '1') {
        // suppress this click which is the result of pointerup after drag
        e.preventDefault(); e.stopImmediatePropagation();
        btn.removeAttribute('data-was-dragged');
        return;
      }
    } catch {}
    // prevent re-click while loading; allow dragging (cursor: grab)
    if (btn.getAttribute('data-loading') === '1') return;
    btn.setAttribute('data-loading', '1');
    const prevHtml = btn.innerHTML;
    btn.innerHTML = '<div class="__ai_spinner" aria-hidden="true"></div>&nbsp;Audit';
    analyzeAndMaybeSend().finally(() => {
      try { btn.removeAttribute('data-loading'); btn.innerHTML = prevHtml; } catch {}
    });
  };
  btn.addEventListener('click', onBtnClick);
  // intercept native send on the anchored send button to enforce blocking
  try {
    const sendBtn = adapter.findSendButton();
    if (sendBtn) {
      const original = sendBtn.addEventListener.bind(sendBtn);
      // Add a capturing listener to intercept submits/Clicks
      sendBtn.addEventListener('click', (ev) => {
        // if programmatic allow was set (apply & send), don't intercept
        if (isProgrammaticAllowed(sendBtn)) return;
        // otherwise run audit and possibly block
        ev.preventDefault(); ev.stopPropagation();
        (async () => {
          await loadSettings();
          const text = adapter.getDraft(adapter.findInput()!);
          const req = { text, source: adapter.id, url: location.href, ts: Date.now() };
          try { showLoader(); } catch {}
          const resp = await sendMessageToBg({ type: MSG.ANALYZE_PROMPT, payload: req }) as any;
          if (resp === null) {
            // try direct backend if configured
            const settings = await new Promise<any>((resolve) => { try { chrome.storage.local.get('settings', (r) => resolve(r?.settings ?? null)); } catch { resolve(null); } });
            if (settings?.baseUrl) {
              const df = await directAnalyzeViaFetch(text);
              if (!df.ok || !df.result) { toast('Analyzer error', 'err'); try { hideLoader(); } catch {} ; return; }
              const directResult: any = { ok: true, findings: df.result?.findings || [], report: df.result?.report };
              const findings = directResult.findings || [];
              const hasHigh = findings.some((f: any) => f.severity === 'error');
              if (settings.blockOnHighRisk && hasHigh) { try { applyUiBlock(); } catch {} showOverrideModal(adapter, sendBtn, findings, text); try { hideLoader(); } catch {}; return; }
              if (OVERLAY_ENABLED) renderOverlay(text, findings, undefined, { report: directResult.report });
              try { hideLoader(); } catch {};
              return;
            }
            toast('Background analyzer unavailable — open extension options or reload the extension', 'err');
            try { hideLoader(); } catch {} ;
            return;
          }
          if (!resp?.ok || !resp.result) { toast('Analyzer error', 'err'); try { hideLoader(); } catch {} ; return; }
          const findings = resp.result.findings || [];
          const hasHigh = findings.some((f: any) => f.severity === 'error');
          const settings = cachedSettings || { blockOnHighRisk: false, piiGuardEnabled: true };
          if (settings.piiGuardEnabled) {
            // mask before sending to remote if desired - here we mask only when user overrides
          }
          if (settings.blockOnHighRisk && hasHigh) {
            // show override modal with UI blocking
            try { applyUiBlock(); } catch {}
            showOverrideModal(adapter, sendBtn, findings, text);
            try { hideLoader(); } catch {};
            return;
          }
          // otherwise allow the click to proceed after showing overlay optionally
          if (OVERLAY_ENABLED) renderOverlay(text, findings);
          // allow the original click to continue (simulate a user click)
          markSendAllowedTemporarily(sendBtn);
          // re-dispatch a click to let the site handle it
          try { hideLoader(); } catch {};
          sendBtn.click();
        })();
      }, { capture: true });
    }
  } catch (err) {}
  try { document.body.dataset.aiAuditorInjected = adapter.id; } catch {}
  try { makeDraggableAndPersist(btn, adapter.id); } catch {}
}

// Ensure any lingering UI/network blocks are removed when extension unloads or page navigates away
try {
  window.addEventListener('beforeunload', () => { try { removeUiBlock(); } catch {} }, { capture: true });
  // also unconditionally listen for a custom global unbind (helps tests)
  window.addEventListener('message', (ev) => { try { if (ev.data && ev.data.__ai_auditor_control === 'force_unblock') removeUiBlock(); } catch {} }, true);
} catch {}

// ----- draggable + persistence helpers -----
function makeDraggableAndPersist(btn: HTMLButtonElement, adapterId: string) {
  let dragging = false;
  let startX = 0; let startY = 0;
  let startLeft = 0; let startTop = 0;

  const onPointerDown = (ev: PointerEvent) => {
    // don't preventDefault here — that can interfere with click synthesis on some sites
    try { (ev.target as Element).setPointerCapture(ev.pointerId); } catch {}
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = parseInt(btn.style.left || '0', 10) || btn.getBoundingClientRect().left;
    startTop = parseInt(btn.style.top || '0', 10) || btn.getBoundingClientRect().top;
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const onPointerMove = (ev: PointerEvent) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    // mark moved if user dragged more than a few pixels
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) (btn as any).__ai_moved = true;
    let left = startLeft + dx;
    let top = startTop + dy;
    // constrain to viewport
    left = Math.max(8, Math.min(window.innerWidth - btn.offsetWidth - 8, left));
    top = Math.max(8, Math.min(window.innerHeight - btn.offsetHeight - 8, top));
    btn.style.left = `${Math.round(left)}px`;
    btn.style.top = `${Math.round(top)}px`;
  };

  const onPointerUp = async (ev: PointerEvent) => {
    dragging = false;
    try { (ev.target as Element).releasePointerCapture(ev.pointerId); } catch {}
    document.removeEventListener('pointermove', onPointerMove);
    // persist position
    const left = Math.round(parseFloat(btn.style.left || '0'));
    const top = Math.round(parseFloat(btn.style.top || '0'));
    // mark pinned immediately so observers don't auto-reposition while storage writes
    try { btn.setAttribute('data-manual-pinned', '1'); } catch {}
    // mark that a drag just occurred so the consequent click is suppressed — only if pointer actually moved
    try {
      if ((btn as any).__ai_moved) {
        btn.setAttribute('data-was-dragged', '1');
      }
    } catch {}
    try { (btn as any).__ai_moved = false; } catch {}
    await saveStoredButtonPos({ adapterId, left, top, manual: true });
  };

  btn.style.touchAction = 'none';
  btn.addEventListener('pointerdown', onPointerDown);
}

function getStoredButtonPos(): Promise<{adapterId: string; left: number; top: number; manual?: boolean} | null> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['aiAuditor_btn_pos'], (res) => {
        resolve(res?.aiAuditor_btn_pos ?? null);
      });
    } catch (err) { resolve(null); }
  });
}

function saveStoredButtonPos(val: {adapterId: string; left: number; top: number; manual?: boolean}): Promise<void> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({ aiAuditor_btn_pos: val }, () => resolve());
    } catch (err) { resolve(); }
  });
}

function positionButtonNear(sendEl: HTMLButtonElement, btnEl: HTMLButtonElement) {
  try {
    btnEl.style.position = 'fixed';
    btnEl.style.zIndex = '2147483647';
    btnEl.style.pointerEvents = 'auto';
    // minimal reset to avoid site styles
    btnEl.style.margin = '0';
    btnEl.style.padding = '.35rem .6rem';
    btnEl.style.borderRadius = '10px';
    const rect = sendEl.getBoundingClientRect();
    const btnW = 64; // approximate width if not rendered yet
    const btnH = 36;
    const computedW = btnEl.offsetWidth || btnW;
    const computedH = btnEl.offsetHeight || btnH;
    // try placing to the left of send, fallback to right
    let left = Math.max(8, rect.left - computedW - 8);
    if (left < 8) left = Math.min(window.innerWidth - computedW - 8, rect.right + 8);
    const top = Math.min(window.innerHeight - computedH - 8, Math.max(8, rect.top + (rect.height - computedH) / 2));
    btnEl.style.left = `${Math.round(left)}px`;
    btnEl.style.top = `${Math.round(top)}px`;
  } catch (err) {
    // ignore
  }
}

let lastUrl = location.href;
const debouncedMount = debounce(async () => {
  if (!getActiveAdapter()) return;
  ensureStyles();
  attachHotkeyOnce();
  // Reinjection logic: only inject if our button missing or belongs to a different adapter
  const currentAdapter = getActiveAdapter();
  if (!currentAdapter) return;
  try {
    const rawSettings = await new Promise<any>((resolve) => {
      try { chrome.storage.local.get('settings', (r) => resolve(r?.settings ?? null)); } catch { resolve(null); }
    });
    const enabled = (rawSettings?.flags?.enabledSites as string[] | undefined) ?? ['chatgpt'];
    if (!enabled.includes(currentAdapter.id)) {
      // if disabled for this site, remove any existing UI
      const existing = document.getElementById(IDS.btn);
      if (existing) try { existing.remove(); } catch {}
    } else {
      if (document.body.dataset.aiAuditorInjected !== currentAdapter.id || !document.getElementById(IDS.btn)) {
        maybeInjectButton();
      }
      // setup inline hints when site is enabled
      try { await setupInlineHints(currentAdapter); } catch {}
    }
  } catch (err) {
    if (document.body.dataset.aiAuditorInjected !== currentAdapter.id || !document.getElementById(IDS.btn)) {
      maybeInjectButton();
    }
    try { await setupInlineHints(currentAdapter); } catch {}
  }
  // SPA navigation handling: remove overlay on URL change
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    removeOverlay();
    // also dispose inline hints between SPA routes
    try { disposeInlineHints(); } catch {}
  }
}, 350);

// ----- File interceptors (drop/paste/change) -----
(() => {
  const g = window as any;
  if (g.__curestryFileInterceptWired) return; g.__curestryFileInterceptWired = true;

  // Inject a small page-script so we capture events that happen inside page's
  // shadow DOMs or in page context. The injected script posts events to window
  // which the content script listens for.
  try {
    // Prefer injecting an external page script file (extension resource) to avoid CSP blocking
    const s = document.createElement('script');
    // prefer external resource copied to dist root as page-inject.js
    try { s.src = chrome.runtime.getURL('public/page-inject.js'); } catch (e) { /* ignore */ }
    // fallback inline code in case external file fails or CSP blocks loading
    const pageInjectCode = `(() => {\n  function makeUid(el) { try { if (!(el instanceof Element)) return null; const id = 'curestry-' + Math.random().toString(36).slice(2,9); el.setAttribute('data-curestry-uid', id); return id; } catch (e) { return null; } }\n  function postUid(target, type, files) { try { const uid = makeUid(target); const fileArr = files ? Array.from(files) : []; window.postMessage({ __curestry_file_event: true, evType: type, uid: uid, files: fileArr }, '*'); } catch (e) {} }\n  document.addEventListener('change', (e) => { try { const t = e.target; if (t && t.tagName === 'INPUT' && t.type === 'file') { postUid(t, 'change', t.files); } } catch (err) {} }, true);\n  document.addEventListener('drop', (e) => { try { const dt = e.dataTransfer; postUid(e.target, 'drop', dt ? dt.files : null); } catch (err) {} }, true);\n  document.addEventListener('paste', (e) => { try { const cd = e.clipboardData; postUid(e.target, 'paste', cd ? cd.files : null); } catch (err) {} }, true);\n})();`;
    // If external injection fails, do not inject inline script (CSP will block execution and throw).
    s.onerror = () => {
      try { console.warn('[Content] page-inject load failed; requesting background fallback'); } catch {}
      try {
        // ask background to run scripting.executeScript fallback
        const tabId = (window as any).__ai_auditor_tabId || null;
        try { chrome.runtime.sendMessage({ type: 'FALLBACK_INJECT_PAGE_SCRIPT', payload: { tabId } }, (resp) => {}); } catch {}
        try { window.postMessage({ __ai_auditor_control: 'page_inject_failed' }, '*'); } catch {}
      } catch (e) {}
    };
    (document.documentElement || document.head || document.body || document).appendChild(s);
  } catch (err) {}

  async function handleFilesEvent(ev: Event, files: File[] | null, targetEl?: EventTarget | null) {
    if (!files || !files.length) return; // nothing to do
    try { await loadSettings(); } catch {}
    const settings = cachedSettings || { blockOnHighRisk: true, piiGuardEnabled: true };
    if (!settings.piiGuardEnabled) return; // pass through
    // Don't prevent default here — allow the site to receive the original event.
    // We will show a modal on high-risk findings and attempt to clear inputs if the user cancels.
    // scan
    // deduplicate identical rapid events (drag+page-inject reposts, etc.)
    const sig = makeFilesSignature(files || []);
    const now = Date.now();
    const prev = recentFileEventSignatures.get(sig) || 0;
    if (now - prev < FILE_EVENT_DEDUP_MS) {
      try { console.debug && console.debug('curestry: dedup skip', { sig }); } catch {}
      return;
    }

    // also dedupe by individual File object references if they were seen very recently
    try {
      let seenRecently = false;
      for (const f of files) {
        const t = recentFileObjects.get(f);
        if (t && now - t < FILE_EVENT_DEDUP_MS) { seenRecently = true; break; }
      }
      if (seenRecently) {
        try { console.debug && console.debug('curestry: dedup skip (file objects)', { sig }); } catch {}
        recentFileEventSignatures.set(sig, now);
        return;
      }
      for (const f of files) recentFileObjects.set(f, now);
    } catch (e) {}

    recentFileEventSignatures.set(sig, now);

    const analyses = await scanFilesLocally(Array.from(files));
    const agg = aggregateMaxSeverity(analyses as any);
    try { console.debug && console.debug('curestry: file intercept', { files: files.map(f=>f.name), agg, analyses }); } catch {}
    // If high-risk and PII guard enabled, always surface modal so user sees findings.
    if (agg === 'high' && settings.piiGuardEnabled) {
      // For change events we must synchronously clear the input to prevent site handlers
      // from immediately uploading the files. For other events, stop propagation so site
      // doesn't receive the native event while modal is shown. Also set a global flag
      // visible to page-inject to block page-context listeners while modal is up.
      try {
        try { (window as any).__curestry_block_upload = true; } catch {}
        if (ev.type === 'change') {
          const inp = targetEl as HTMLInputElement | null;
          if (inp && inp.tagName === 'INPUT' && inp.type === 'file') {
            try { inp.value = ''; } catch { try { (inp as any).files = new DataTransfer().files; } catch {} }
            // mark cleared so we can reinject later if user allows
            try { inp.setAttribute('data-curestry-cleared', '1'); } catch {}
          }
        } else {
          ev.preventDefault && ev.preventDefault(); ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        }
      } catch {}

      // Before showing modal, send page-inject a 'block' command to aggressively
      // prevent network activity from page context while modal is visible.
      try { window.postMessage({ __curestry_control: 'block' }, '*'); } catch {}
      const choice = await showPiiModal(analyses as any);
      if (choice !== 'allow') {
        // User declined — always remove the file(s) from the page and keep a short block
        const CANCEL_BLOCK_MS = 2000;
        try {
          // Clear input if target is an input element
          const inp = targetEl as HTMLInputElement | null;
          if (inp && inp.tagName === 'INPUT' && inp.type === 'file') {
            try { inp.value = ''; } catch {};
            try { (inp as any).files = new DataTransfer().files; } catch {}
            try { inp.setAttribute('data-curestry-cleared', '1'); } catch {}
          }
        } catch (e) {}

        // keep page-level uploads blocked for a short while to avoid racey reposts
        try { (window as any).__curestry_block_upload = true; } catch {}
        // Also prevent form submits and clicks during the block window
        const submitHandler = (ev: Event) => { try { ev.preventDefault(); ev.stopImmediatePropagation(); } catch {} };
        const clickHandler = (ev: Event) => { try { const t = ev.target as HTMLElement | null; if (!t) return; const btn = (t.closest && t.closest('button,input[type=submit]')) as HTMLElement | null; if (btn) { ev.preventDefault(); ev.stopImmediatePropagation(); } } catch {} };
        try { document.addEventListener('submit', submitHandler, true); document.addEventListener('click', clickHandler, true); } catch {}
        setTimeout(() => {
          try { (window as any).__curestry_block_upload = false; } catch {}
          try { document.removeEventListener('submit', submitHandler, true); document.removeEventListener('click', clickHandler, true); } catch {}
        }, CANCEL_BLOCK_MS);
        // Also tell page-inject to unblock network after a short delay
        try { setTimeout(() => { window.postMessage({ __curestry_control: 'unblock' }, '*'); }, CANCEL_BLOCK_MS); } catch {}

        // do not reinject — user cancelled
        try { removeFilePreviewsByName(files.map(f => f.name)); } catch {}
        try { approvedFiles.delete(sig); } catch {}
        try { console.debug && console.debug('curestry: user cancelled upload, cleared files'); } catch {}
        return; // blocked
      }

      // user allowed → mark approved and continue reinjection
      try { if (targetEl && (targetEl as Element).setAttribute) (targetEl as Element).setAttribute('data-curestry-approved', '1'); } catch {}
      try { (window as any).__curestry_block_upload = false; } catch {}
      try { window.postMessage({ __curestry_control: 'unblock' }, '*'); } catch {}
    }
    // If there are no findings, allow the event to proceed normally.
    if (agg !== 'high') {
      // nothing else to do — do not block or re-inject
      return;
    }
    // Re-inject: if original target is input[type=file], set files via DataTransfer
    try {
      const tgt = targetEl as HTMLElement | null;
      if (tgt && tgt.tagName === 'INPUT' && (tgt as HTMLInputElement).type === 'file') {
        const input = tgt as HTMLInputElement;
        // If event was a native change, files are already present — just mark approved and return
        if (ev.type === 'change') {
          try { (input as any).__curestryApproved__ = true; } catch {}
          return;
        }
        try {
          const srcFiles = approvedFiles.get(sig) || Array.from(files);
          const dt = new DataTransfer();
          for (const f of srcFiles) dt.items.add(f as any);
          // mark to avoid re-capture
          (input as any).__curestryApproved__ = true;
          (input as any).files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (err) {
          try { console.warn('reinject file to input failed', err); } catch {}
        }
      } else {
        // synthesize drop event on original target if possible
        try {
          const srcFiles = approvedFiles.get(sig) || Array.from(files);
          const dt = new DataTransfer(); for (const f of srcFiles) dt.items.add(f as any);
          const de = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt as any });
          // mark approved before dispatch so injected page -> postMessage path is ignored
          try { if (targetEl && (targetEl as any)) (targetEl as any).__curestryApproved__ = true; } catch {}
          if (targetEl && (targetEl as Element).dispatchEvent) {
            (targetEl as Element).dispatchEvent(de as any);
          } else {
            // target missing (shadow/root boundary) — dispatch on document as fallback
            document.dispatchEvent(de as any);
          }
        } catch (err) { try { console.warn('synth drop failed', err); } catch {} }
      }
    } catch (err) { }
  }

  function extractFilesFromEvent(e: Event) {
    try {
      if ((e as DragEvent).dataTransfer) {
        const dt = (e as DragEvent).dataTransfer!;
        if (dt.files && dt.files.length) return { files: Array.from(dt.files), target: e.target };
      }
      if ((e as ClipboardEvent).clipboardData) {
        const cd = (e as ClipboardEvent).clipboardData!;
        if (cd.files && cd.files.length) return { files: Array.from(cd.files), target: e.target };
      }
      // change events handled elsewhere via MutationObserver for inputs
    } catch (err) {}
    return null;
  }

  document.addEventListener('drop', (ev) => {
    try {
      const ex = (ev.target as any)?.__curestryApproved__;
      if (ex) return; // skip approved path
      const out = extractFilesFromEvent(ev);
      if (out) { handleFilesEvent(ev, out.files, out.target); }
    } catch (err) {}
  }, { capture: true });

// We prefer loading the external `public/page-inject.js` via a <script src=...> tag above.
// Do NOT inject inline scripts here (CSP on many sites will block them). If the external
// script fails to load, fall back to content-side capture handlers already present in this file.

  document.addEventListener('paste', (ev) => {
    try {
      const out = extractFilesFromEvent(ev);
      if (out) { handleFilesEvent(ev, out.files, out.target); }
    } catch (err) {}
  }, { capture: true });

  // For input[type=file] changes, intercept via capture on document for change events
  document.addEventListener('change', (ev) => {
    try {
      const tgt = ev.target as HTMLElement | null;
      if (!tgt) return;
      if (tgt.tagName === 'INPUT' && (tgt as HTMLInputElement).type === 'file') {
        if ((tgt as any).__curestryApproved__) { try { delete (tgt as any).__curestryApproved__; } catch {} ; return; }
        const input = tgt as HTMLInputElement;
        const files = input.files ? Array.from(input.files) : [];
        if (!files.length) return;
        handleFilesEvent(ev, files, tgt);
      }
    } catch (err) {}
  }, { capture: true });

  // Listen for messages from injected page script
  window.addEventListener('message', (ev: MessageEvent) => {
    try {
      if (!ev.data || !ev.data.__curestry_file_event) return;
      const files = ev.data.files as File[] | undefined;
      const uid = ev.data.uid as string | null;
      const evType = ev.data.evType as string | undefined;
      let target: Element | null = null;
      if (uid) try { target = document.querySelector(`[data-curestry-uid="${uid}"]`) as Element | null; } catch {}
      if (!files || !files.length) return;
      // create a fake Event object to pass type
      const fakeEv = new Event(evType || 'drop', { bubbles: true, cancelable: true });
      handleFilesEvent(fakeEv, files, target);
    } catch (err) {}
  });
})();

debouncedMount();
const mo = new MutationObserver(() => debouncedMount());
// Debounce top-level observer to avoid excessive reinjections
let topMoTimer: number | undefined;
mo.observe(document.documentElement, { childList: true, subtree: true });
mo.disconnect = (() => {
  const original = mo.disconnect.bind(mo);
  return () => {
    if (topMoTimer) clearTimeout(topMoTimer as any);
    original();
  };
})();


// React to settings changes in real time
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.settings) {
      // refresh cached toggles and inline hints overlay state
      loadSettings().then(async () => {
        const adapter = getActiveAdapter();
        if (!adapter) return;
        await setupInlineHints(adapter);
      }).catch(() => {});
    }
  });
} catch {}


// Intercept Enter key proactively when settings.blockOnHighRisk is enabled.
function interceptEnterIfHigh(e: KeyboardEvent) {
  try {
    if (!e || !e.key) return;
    if (e.key.toLowerCase() !== 'enter') return;
    // don't interfere if our modal is already open
    if (document.getElementById('__ai_auditor_override__')) return;
    const adapter = getAdapter();
    if (!adapter) return;
    const input = adapter.findInput();
    if (!input) return;
    const active = document.activeElement;
    if (!(active === input || (input.contains && input.contains(active as Node)))) return;
    const settings = cachedSettings || { blockOnHighRisk: false, piiGuardEnabled: true };
    if (!settings.blockOnHighRisk) return;
    const text = adapter.getDraft(input).trim();
    if (!text) return;
    const findings: any[] = [];
    // quick local heuristics: email/phone/cc
    try { if (_emailRe.test(text)) findings.push({ severity: 'high', message: `Contains email-like patterns: ${text.match(_emailRe)?.[0]}` }); } catch {}
    try { if (_phoneRe.test(text)) findings.push({ severity: 'high', message: `Contains phone-like patterns` }); } catch {}
    // run quality patterns if available
    try {
      const q = typeof runQualityPatterns === 'function' ? runQualityPatterns(text) : [];
      for (const fq of q || []) {
        if ((fq as any).severity === 'high') findings.push({ severity: 'high', message: (fq as any).message || 'High severity pattern' });
      }
    } catch {}
    if (!findings.length) return; // nothing high-risk detected locally
    // block the enter/send
    try { e.preventDefault(); e.stopImmediatePropagation(); } catch {}
    try { applyUiBlock(); } catch {}
    try { const sendBtn = adapter.findSendButton ? adapter.findSendButton() : null; showOverrideModal(adapter, sendBtn as HTMLButtonElement, findings, text); } catch {}
  } catch (err) { try { console.error('[Content] interceptEnterIfHigh error', err); } catch {} }
}

try { document.addEventListener('keydown', interceptEnterIfHigh, true); } catch {}



