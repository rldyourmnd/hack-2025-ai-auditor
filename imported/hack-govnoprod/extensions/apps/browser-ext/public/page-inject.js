(() => {
  function makeUid(el) {
    try {
      if (!(el instanceof Element)) return null;
      const id = 'curestry-' + Math.random().toString(36).slice(2, 9);
      el.setAttribute('data-curestry-uid', id);
      return id;
    } catch (e) { return null; }
  }

  function postUid(target, type, files) {
    try {
      // If this element was injected/synthesized by the extension, avoid reposting
      try { if (target && (target.getAttribute && target.getAttribute('data-curestry-injected'))) return; } catch (e) {}
      const uid = makeUid(target);
      // include files (FileList -> array) when available
      const fileArr = files ? Array.from(files) : [];
      window.postMessage({ __curestry_file_event: true, evType: type, uid: uid, files: fileArr }, '*');
    } catch (e) {}
  }

  document.addEventListener('change', (e) => {
    try {
      // If page context indicates uploads are blocked, stop
      if (window.__curestry_block_upload) {
        try { e.preventDefault(); e.stopImmediatePropagation(); } catch (err) {}
        return;
      }
      const t = e.target;
      if (t && t.tagName === 'INPUT' && t.type === 'file') {
        postUid(t, 'change', t.files);
      }
    } catch (err) {}
  }, true);

  document.addEventListener('drop', (e) => {
    try {
      if (window.__curestry_block_upload) {
        try { e.preventDefault(); e.stopImmediatePropagation(); } catch (err) {}
        return;
      }
      const dt = e.dataTransfer;
      postUid(e.target, 'drop', dt ? dt.files : null);
    } catch (err) {}
  }, true);

  document.addEventListener('paste', (e) => {
    try {
      if (window.__curestry_block_upload) {
        try { e.preventDefault(); e.stopImmediatePropagation(); } catch (err) {}
        return;
      }
      const cd = e.clipboardData;
      postUid(e.target, 'paste', cd ? cd.files : null);
    } catch (err) {}
  }, true);
})();

// Listen for control messages from content script to block/unblock network while modal is shown
(() => {
  let originals = null;
  function blockNetwork() {
    if (window.__curestry_net_blocked) return;
    originals = { fetch: window.fetch, xhrSend: XMLHttpRequest.prototype.send };
    try {
      window.fetch = function(input, init) {
        try {
          const body = init && init.body ? init.body : null;
          // block FormData uploads or bodies that contain File/Blob
          if (body instanceof FormData) {
            for (const v of body.values()) {
              try {
                if (v instanceof File || v instanceof Blob) {
                  console.warn('curestry: blocked fetch upload');
                  return Promise.reject(new DOMException('Upload blocked by extension','AbortError'));
                }
              } catch (e) {}
            }
          }
          if (body instanceof Blob) {
            console.warn('curestry: blocked fetch blob upload');
            return Promise.reject(new DOMException('Upload blocked by extension','AbortError'));
          }
        } catch (e) {}
        return originals.fetch.apply(this, arguments);
      };
    } catch (e) {}
    try {
      XMLHttpRequest.prototype.send = function(body) {
        try {
          if (body instanceof FormData) {
            for (const v of body.values()) {
              try {
                if (v instanceof File || v instanceof Blob) {
                  console.warn('curestry: blocked xhr upload');
                  try { this.abort(); } catch (e) {}
                  // dispatch error + loadend so page code gets a graceful failure
                  try { setTimeout(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')); }, 0); } catch (e) {}
                  return;
                }
              } catch (e) {}
            }
          }
          if (body instanceof Blob) {
            console.warn('curestry: blocked xhr blob upload');
            try { this.abort(); } catch (e) {}
            try { setTimeout(() => { this.dispatchEvent(new Event('error')); this.dispatchEvent(new Event('loadend')); }, 0); } catch (e) {}
            return;
          }
        } catch (e) {}
        return originals.xhrSend.apply(this, arguments);
      };
    } catch (e) {}
    window.__curestry_net_blocked = true;
    try { window.postMessage({ __curestry_block_status: 'blocked' }, '*'); } catch (e) {}
  }
  function unblockNetwork() {
    if (!window.__curestry_net_blocked) return;
    try { if (originals && originals.fetch) window.fetch = originals.fetch; } catch (e) {}
    try { if (originals && originals.xhrSend) XMLHttpRequest.prototype.send = originals.xhrSend; } catch (e) {}
    window.__curestry_net_blocked = false;
    originals = null;
    try { window.postMessage({ __curestry_block_status: 'unblocked' }, '*'); } catch (e) {}
  }

  window.addEventListener('message', (ev) => {
    try {
      if (!ev.data || !ev.data.__curestry_control) return;
      const cmd = ev.data.__curestry_control;
      if (cmd === 'block') blockNetwork();
      if (cmd === 'unblock') unblockNetwork();
      // Backwards-compatible listener for ai_auditor control messages
      if (ev.data && ev.data.__ai_auditor_control) {
        const aicmd = ev.data.__ai_auditor_control;
        if (aicmd === 'block_sends') blockAllSends();
        if (aicmd === 'unblock_sends') unblockAllSends();
      }
    } catch (e) {}
  });
})();

// Additional patch: block/unblock *all* outgoing send APIs (fetch/XHR/WebSocket)
(() => {
  let originalsAll = null;
  function blockAllSends() {
    if (window.__ai_auditor_all_blocked) return;
    try {
      originalsAll = { fetch: window.fetch, xhrSend: XMLHttpRequest.prototype.send, WS: window.WebSocket };
    } catch (e) { originalsAll = null; }
    try {
      if (window.fetch) {
        window.fetch = function() { return Promise.reject(new Error('Blocked by AI Auditor')); };
      }
    } catch (e) {}
    try {
      const _xhrOrig = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function() { try { this.abort(); } catch (e) {} throw new Error('Blocked by AI Auditor'); };
      if (originalsAll && !originalsAll.xhrSend) originalsAll.xhrSend = _xhrOrig;
    } catch (e) {}
    try {
      const _WS = window.WebSocket;
      if (_WS) {
        const PatchedWS = function(url, proto) { throw new Error('Blocked by AI Auditor'); };
        PatchedWS.prototype = _WS.prototype;
        window.WebSocket = PatchedWS;
      }
    } catch (e) {}

    // Aggressively block synthetic DOM events and programmatic clicks while blocked.
    try {
      try { if (!originalsAll) originalsAll = {}; } catch {}
      // store originals
      try { originalsAll.dispatchEvent = EventTarget.prototype.dispatchEvent; } catch {}
      try { originalsAll._click = HTMLElement.prototype.click; } catch {}

      EventTarget.prototype.dispatchEvent = function(evt) {
        try {
          if (window.__ai_auditor_all_blocked) {
            const t = (evt && typeof evt.type === 'string') ? evt.type : null;
            // only block common send-related synthetic events
            if (t === 'click' || t === 'submit' || t === 'keydown' || t === 'keyup') {
              try {
                const path = (evt && typeof evt.composedPath === 'function') ? evt.composedPath() : [evt && evt.target];
                for (const p of path) {
                  try {
                    if (p && p instanceof Element) {
                      if (p.closest && (p.closest('#__ai_auditor_override__') || p.closest('[data-curestry-uid]') || p.closest('[data-ai-auditor-allow]'))) {
                        return originalsAll.dispatchEvent.apply(this, arguments);
                      }
                    }
                  } catch {}
                }
              } catch {}
              // swallow synthetic send events
              try { console.warn('ai_auditor: blocked dispatchEvent', t); } catch {}
              return true;
            }
          }
        } catch {}
        return originalsAll.dispatchEvent.apply(this, arguments);
      };

      HTMLElement.prototype.click = function() {
        try {
          if (window.__ai_auditor_all_blocked) {
            try {
              if (this && this.closest && this.closest('#__ai_auditor_override__')) {
                return originalsAll._click.apply(this, arguments);
              }
            } catch {}
            try { console.warn('ai_auditor: blocked programmatic click'); } catch {}
            return undefined;
          }
        } catch {}
        return originalsAll._click.apply(this, arguments);
      };
    } catch (e) {}

    window.__ai_auditor_all_blocked = true;
    try { window.postMessage({ __ai_auditor_block_status: 'blocked' }, '*'); } catch (e) {}
  }

  function unblockAllSends() {
    if (!window.__ai_auditor_all_blocked) return;
    try { if (originalsAll && originalsAll.fetch) window.fetch = originalsAll.fetch; } catch (e) {}
    try { if (originalsAll && originalsAll.xhrSend) XMLHttpRequest.prototype.send = originalsAll.xhrSend; } catch (e) {}
    try { if (originalsAll && originalsAll.WS) window.WebSocket = originalsAll.WS; } catch (e) {}
    // restore patched dispatchEvent and click
    try { if (originalsAll && originalsAll.dispatchEvent) EventTarget.prototype.dispatchEvent = originalsAll.dispatchEvent; } catch (e) {}
    try { if (originalsAll && originalsAll._click) HTMLElement.prototype.click = originalsAll._click; } catch (e) {}
    window.__ai_auditor_all_blocked = false;
    originalsAll = null;
    try { window.postMessage({ __ai_auditor_block_status: 'unblocked' }, '*'); } catch (e) {}
  }

  // expose helpers to other injected scopes (no-op if not desired)
  try { window.__ai_auditor_blockAllSends = blockAllSends; window.__ai_auditor_unblockAllSends = unblockAllSends; } catch (e) {}
})();

(() => {
  function makeUid(el) {
    try {
      if (!(el instanceof Element)) return null;
      const id = 'curestry-' + Math.random().toString(36).slice(2, 9);
      el.setAttribute('data-curestry-uid', id);
      return id;
    } catch (e) { return null; }
  }

  function postUid(target, type, files) {
    try {
      const uid = makeUid(target);
      const fileArr = files ? Array.from(files) : [];
      window.postMessage({ __curestry_file_event: true, evType: type, uid: uid, files: fileArr }, '*');
    } catch (e) {}
  }

  // attach capture-phase listeners but DO NOT preventDefault — let site handle the event
  document.addEventListener('change', (e) => {
    try {
      const t = e.target;
      if (t && t.tagName === 'INPUT' && t.type === 'file') {
        postUid(t, 'change', t.files);
      }
    } catch (err) {}
  }, true);

  document.addEventListener('drop', (e) => {
    try {
      const dt = e.dataTransfer;
      postUid(e.target, 'drop', dt ? dt.files : null);
    } catch (err) {}
  }, true);

  document.addEventListener('paste', (e) => {
    try {
      const cd = e.clipboardData;
      postUid(e.target, 'paste', cd ? cd.files : null);
    } catch (err) {}
  }, true);
})();


