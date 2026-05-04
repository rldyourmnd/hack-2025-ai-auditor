import type { SiteAdapter } from './siteAdapter';
import { findSendButtonGeneric } from './utils';

export const GeminiAdapter: SiteAdapter = {
  id: 'gemini',
  matches: (loc) => /gemini\.google\.com/.test(loc.host),
  findInput(doc = document) {
    const ta = doc.querySelector('textarea');
    if (ta instanceof HTMLTextAreaElement && ta.offsetParent) return ta;
    const ed = doc.querySelector('[contenteditable="true"]') as HTMLElement | null;
    return ed && ed.offsetParent ? ed : null;
  },
  findSendButton(doc = document) {
    return findSendButtonGeneric(doc);
  },
  getDraft(el) {
    return el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
  },
  setDraft(el, text) {
    if (el instanceof HTMLTextAreaElement) el.value = text; else el.textContent = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  anchorForButton(sendBtn) { return sendBtn.parentElement ?? sendBtn; },
};


