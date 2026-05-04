export function isElementVisible(el: Element | null) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity || '1') === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function findSendButtonGeneric(doc: Document = document): HTMLButtonElement | null {
  // Prefer actual button/input elements first
  const sendRegex = /send|submit|ask|отправ|отправить|send message|reply|ответ/i;
  const btns = Array.from(doc.querySelectorAll<HTMLButtonElement>('button')) as HTMLButtonElement[];
  for (const b of btns) {
    if (!isElementVisible(b)) continue;
    // prefer explicit submit
    if (b.type === 'submit') return b;
    const aria = (b.getAttribute('aria-label') || b.getAttribute('title') || b.getAttribute('data-testid') || '') || '';
    const text = (b.textContent || '').trim();
    if (aria && sendRegex.test(aria)) return b;
    if (text && sendRegex.test(text)) return b;
  }
  // check input[type=submit]
  const inputs = Array.from(doc.querySelectorAll<HTMLInputElement>('input[type="submit"]')) as HTMLInputElement[];
  for (const i of inputs) {
    if (!isElementVisible(i)) continue;
    return i as unknown as HTMLButtonElement;
  }
  // fallback: any visible element with role=button and matching text/aria
  const roleBtns = Array.from(doc.querySelectorAll<HTMLElement>('[role="button"]'));
  for (const el of roleBtns) {
    if (!isElementVisible(el)) continue;
    const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-testid') || '') || '';
    const text = (el.textContent || '').trim();
    if ((aria && sendRegex.test(aria)) || (text && sendRegex.test(text))) return el as HTMLButtonElement;
  }
  return null;
}


