import type { SiteAdapter } from './siteAdapter';

export const ChatGPTAdapter: SiteAdapter = {
  id: 'chatgpt',
  matches: (loc) => /chat\.openai\.com|chatgpt\.com/.test(loc.host),
  findInput(doc = document) {
    // Prefer the canonical ChatGPT textarea id, then fallback to any textarea, then a visible contenteditable
    const taExact = doc.querySelector('form textarea#prompt-textarea');
    if (taExact instanceof HTMLTextAreaElement && taExact.offsetParent) return taExact;
    const taAny = doc.querySelector('form textarea');
    if (taAny instanceof HTMLTextAreaElement && taAny.offsetParent) return taAny;
    const ed = doc.querySelector('form [contenteditable="true"]') as HTMLElement | null;
    return ed && ed.offsetParent ? ed : null;
  },
  findSendButton(doc = document) {
    // Prefer data-testid first, then submit, then aria-label variants
    const sel = [
      'form button[data-testid="send-button"]',
      'form button[type="submit"]',
      'form button[aria-label*="Send"]',
      'form button[aria-label*="Отправ"]',
    ].join(',');
    const btns = Array.from(doc.querySelectorAll<HTMLButtonElement>(sel));
    return btns.find(b => b.offsetParent && !b.disabled) || null;
  },
  getDraft(el) {
    const raw = el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '');
    return raw.replace(/\u00A0/g, ' ');
  },
  setDraft(el, text) {
    if (el instanceof HTMLTextAreaElement) el.value = text; else el.textContent = text;
    // Ensure the app reacts to programmatic changes
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  anchorForButton(sendBtn) {
    return sendBtn.parentElement ?? sendBtn;
  },
};


