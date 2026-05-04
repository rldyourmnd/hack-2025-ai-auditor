// AI Auditor popup script (external to satisfy CSP)
(function(){
  const LOG_PREFIX = 'AI Auditor (popup)';
  const $ = (id) => document.getElementById(id);
  const $mode = $('mode');
  const $apiBase = $('apiBase');
  const $apiKey = $('apiKey');
  const $modelSelect = document.getElementById('modelSelect');
  const $openaiSection = document.getElementById('openaiSection');
  const $backendSection = document.getElementById('backendSection');
  const $backendUser = document.getElementById('backendUser');
  const $backendPass = document.getElementById('backendPass');
  const $pii = $('piiGuard');
  const $block = $('blockHigh');
  const $inline = $('inlineHints');
  const $siteList = $('siteList');
  const $save = $('saveConfig');
  const $check = $('checkHealth');
  const $health = $('healthStatus');
  const $statusLine = $('statusLine');

  function log(){ try { console.log.apply(console, [LOG_PREFIX + ':'].concat(Array.from(arguments))); } catch{} }

  function defaultSettings(){
    return { version:1, mode:'mock', baseUrl:'', apiKey:'', model:'gpt-5-nano', autoAnalyzeOnPaste:false, maxLength:2000, blockOnHighRisk:false, piiGuardEnabled:true, flags:{ enableMock:true, enableInlineHints:false, enabledSites:['chatgpt'] }, auth: { username: '', password: '' } };
  }

  function setBusy(btn, busy, idleText, busyText){ try { if(btn){ btn.disabled = !!busy; btn.textContent = busy ? busyText : idleText; } } catch{} }

  function updateStatusMode(s){
    try {
      const label = s.mode === 'mock' ? 'Offline (local)' : s.mode === 'openai' ? 'OpenAI (direct)' : 'Remote (backend)';
      if ($statusLine) $statusLine.textContent = 'Mode: ' + label;
    } catch{}
  }

  function buildFromUI(){
    const mode = $mode && $mode.value || 'mock';
    const base = $apiBase && $apiBase.value ? $apiBase.value.trim() : '';
    const key = $apiKey && $apiKey.value ? $apiKey.value.trim() : '';
    const model = $modelSelect && $modelSelect.value ? $modelSelect.value.trim() : 'gpt-5-nano';
    const enabledSites = $siteList ? Array.from($siteList.querySelectorAll('input[type="checkbox"]')).filter(i=>i.checked).map(i=>i.value) : ['chatgpt'];
    return {
      version: 1,
      mode,
      baseUrl: base,
      apiKey: key,
      model,
      autoAnalyzeOnPaste: false,
      maxLength: 2000,
      flags: { enableMock: mode === 'mock', enableInlineHints: !!($inline && $inline.checked), enabledSites },
      blockOnHighRisk: !!($block && $block.checked),
      piiGuardEnabled: !!($pii && $pii.checked),
      auth: { username: ($backendUser && $backendUser.value ? $backendUser.value.trim() : ''), password: ($backendPass && $backendPass.value ? $backendPass.value.trim() : '') },
    };
  }

  function createOverlay() {
    if (document.getElementById('__ai_auditor_popup_toast__')) return;
    const style = document.createElement('style');
    style.id = '__ai_auditor_popup_toast_style__';
    style.textContent = `
      #__ai_auditor_popup_toast__{position:fixed;left:50%;top:12px;transform:translateX(-50%);padding:8px 12px;border-radius:8px;background:#111;color:#fff;font:13px/1.2 system-ui, sans-serif;z-index:9999;opacity:0;transition:opacity .18s,transform .18s}
      #__ai_auditor_popup_toast__.show{opacity:1;transform:translateX(-50%) translateY(0)}
      #__ai_auditor_popup_toast__.ok{background:linear-gradient(90deg,#10b981,#06b6d4)}
      #__ai_auditor_popup_toast__.err{background:linear-gradient(90deg,#ef4444,#f97316)}
    `;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = '__ai_auditor_popup_toast__';
    document.body.appendChild(el);
  }

  function showOverlay(msg, kind='ok', duration=1500){
    try{
      createOverlay();
      const el = document.getElementById('__ai_auditor_popup_toast__');
      if (!el) return;
      el.className = '';
      el.textContent = msg;
      if (kind === 'ok') el.classList.add('ok'); else el.classList.add('err');
      // force reflow then show
      void el.offsetWidth;
      el.classList.add('show');
      setTimeout(()=>{ try { el.classList.remove('show'); } catch{} }, duration);
    } catch(e){ log('overlay error', e); }
  }

  function load(){
    try {
      chrome.storage.local.get(['settings'], (res) => {
        const s = res && res.settings ? res.settings : defaultSettings();
        log('load settings →', s);
        if ($mode) $mode.value = s.mode || 'mock';
        if ($apiBase) $apiBase.value = s.baseUrl || '';
        if ($apiKey) $apiKey.value = s.apiKey || '';
        if ($modelSelect) $modelSelect.value = s.model || 'gpt-5-nano';
        if ($pii) $pii.checked = typeof s.piiGuardEnabled === 'boolean' ? s.piiGuardEnabled : true;
        if ($block) $block.checked = !!s.blockOnHighRisk;
        if ($inline) $inline.checked = !!(s.flags && s.flags.enableInlineHints);
        if ($backendUser) $backendUser.value = (s.auth && s.auth.username) || '';
        if ($backendPass) $backendPass.value = (s.auth && s.auth.password) || '';
        if ($siteList) {
          const enabled = (s.flags && s.flags.enabledSites) || ['chatgpt'];
          Array.from($siteList.querySelectorAll('input[type="checkbox"]')).forEach((ip) => { ip.checked = enabled.includes(ip.value); });
        }
        updateStatusMode(s);
        updateSections();
      });
    } catch (e) { log('load error', e); }
  }

  function updateSections(){
    try {
      const mode = $mode && $mode.value || 'mock';
      if ($openaiSection) $openaiSection.style.display = mode === 'openai' ? '' : 'none';
      if ($backendSection) $backendSection.style.display = mode === 'remote' ? '' : 'none';
    } catch {}
  }

  function save(){
    const cfg = buildFromUI();
    if (cfg.mode === 'remote' && !cfg.baseUrl) { if ($health) $health.textContent = 'Error: base URL required'; showOverlay('Error: base URL required','err'); return; }
    if (cfg.mode === 'openai' && !cfg.apiKey) { if ($health) $health.textContent = 'Error: API key required'; showOverlay('Error: API key required','err'); return; }
    setBusy($save, true, 'Save', 'Saving...'); setBusy($check, true, 'Check health', 'Busy');
    if ($health) $health.textContent = 'Saving...';
    log('save attempt →', cfg);
    try {
      chrome.storage.local.set({ settings: cfg }, () => {
        chrome.storage.local.get(['settings'], (res) => {
          const stored = res && res.settings ? res.settings : null;
          // Verification: compare essential fields only to avoid failures due to storage normalizations
          const equal = (a, b) => {
            if (!a || !b) return false;
            try {
              if (a.mode !== b.mode) return false;
              if ((a.baseUrl || '') !== (b.baseUrl || '')) return false;
              if ((a.apiKey || '') !== (b.apiKey || '')) return false;
              if ((a.model || '') !== (b.model || '')) return false;
              if (Boolean(a.blockOnHighRisk) !== Boolean(b.blockOnHighRisk)) return false;
              if (Boolean(a.piiGuardEnabled) !== Boolean(b.piiGuardEnabled)) return false;
              const fa = (a.flags && a.flags.enabledSites) || [];
              const fb = (b.flags && b.flags.enabledSites) || [];
              if (JSON.stringify(fa.sort()) !== JSON.stringify((fb.slice().sort()))) return false;
              return true;
            } catch (e) { return false; }
          };
          const ok = stored ? equal(stored, cfg) : false;
          log('verify after save →', { ok, stored });
          try { chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); } catch{}
          if ($health) $health.textContent = ok ? 'Saved' : 'Saved (verification mismatch)';
          if (ok) showOverlay('Saved', 'ok'); else showOverlay('Saved (verification mismatch)','ok');
          updateStatusMode(cfg);
          setBusy($save, false, 'Save', 'Saving...'); setBusy($check, false, 'Check health', 'Busy');
        });
      });
    } catch (e) {
      log('save error', e);
      if ($health) $health.textContent = 'Save error';
      showOverlay('Save error','err');
      setBusy($save, false, 'Save', 'Saving...'); setBusy($check, false, 'Check health', 'Busy');
    }
  }

  async function checkHealth(){
    const cfg = buildFromUI();
    setBusy($check, true, 'Check health', 'Checking...'); if ($health) $health.textContent = 'Checking...';
    log('health check →', cfg.mode);
    try {
      if (cfg.mode === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/models', { method:'GET', headers:{ 'Authorization': 'Bearer ' + cfg.apiKey, 'Accept':'application/json' } });
        if ($health) $health.textContent = resp.ok ? 'OK • OpenAI' : ('HTTP ' + resp.status);
        showOverlay(resp.ok ? 'OpenAI OK' : ('HTTP ' + resp.status), resp.ok ? 'ok' : 'err');
        if (resp.ok && $modelSelect) {
          try {
            const j = await resp.json();
            const data = Array.isArray(j.data) ? j.data : [];
            const names = data.map(m => m.id).filter(Boolean);
            const current = $modelSelect.value;
            $modelSelect.innerHTML = '';
            names.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; $modelSelect.appendChild(o); });
            if (names.includes(current)) $modelSelect.value = current;
          } catch (e) { log('models parse error', e); }
        }
      } else if (cfg.mode === 'remote') {
        if (!cfg.baseUrl) { if ($health) $health.textContent = 'No base URL'; setBusy($check, false, 'Check health', 'Checking...'); showOverlay('No base URL','err'); return; }
        const url = cfg.baseUrl.replace(/\/$/, '') + '/healthz';
        const resp = await fetch(url, { method:'GET', mode:'cors' });
        if (resp.ok) { const j = await resp.json().catch(()=>null); if ($health) $health.textContent = 'OK • ' + (j && (j.status||'ok')); showOverlay('Backend OK','ok'); }
        else { if ($health) $health.textContent = 'HTTP ' + resp.status; showOverlay('HTTP ' + resp.status,'err'); }
      } else {
        if ($health) $health.textContent = 'Local mode'; showOverlay('Local mode','ok');
      }
    } catch (e){ if ($health) $health.textContent = 'Error: ' + String(e && e.message || e); showOverlay('Error: ' + String(e && e.message || e),'err'); }
    finally { setBusy($check, false, 'Check health', 'Checking...'); }
  }

  async function maybeFetchModels(){
    const key = $apiKey && $apiKey.value ? $apiKey.value.trim() : '';
    if (!key || !$modelSelect) return;
    try {
      const resp = await fetch('https://api.openai.com/v1/models', { method:'GET', headers:{ 'Authorization': 'Bearer ' + key, 'Accept':'application/json' } });
      if (!resp.ok) return;
      const j = await resp.json();
      const data = Array.isArray(j.data) ? j.data : [];
      const names = data.map(m => m.id).filter(Boolean);
      const current = $modelSelect.value;
      $modelSelect.innerHTML = '';
      names.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; $modelSelect.appendChild(o); });
      if (names.includes(current)) $modelSelect.value = current;
    } catch (e) { log('fetch models error', e); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    if ($save) $save.addEventListener('click', save);
    if ($check) $check.addEventListener('click', checkHealth);
    [$mode,$apiBase,$apiKey,$modelSelect,$pii,$block,$inline,$backendUser,$backendPass].forEach((el)=>{ if (el) el.addEventListener('input', ()=>{ if ($health) $health.textContent = ''; }); });
    if ($siteList) $siteList.addEventListener('change', ()=>{ if ($health) $health.textContent=''; });
    if ($mode) $mode.addEventListener('change', () => { updateSections(); if ($mode.value === 'openai') maybeFetchModels(); });
    if ($apiKey) $apiKey.addEventListener('change', () => { if ($mode && $mode.value === 'openai') maybeFetchModels(); });
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.settings) {
        log('storage change (settings) →', changes.settings.newValue);
        // Update UI when other parts change settings
        const s = changes.settings.newValue;
        if (!s) return;
        if ($mode) $mode.value = s.mode || 'mock';
        if ($apiBase) $apiBase.value = s.baseUrl || '';
        if ($apiKey) $apiKey.value = s.apiKey || '';
        if ($modelSelect) $modelSelect.value = s.model || 'gpt-5-nano';
        if ($pii) $pii.checked = typeof s.piiGuardEnabled === 'boolean' ? s.piiGuardEnabled : true;
        if ($block) $block.checked = !!s.blockOnHighRisk;
        if ($inline) $inline.checked = !!(s.flags && s.flags.enableInlineHints);
        if ($backendUser) $backendUser.value = (s.auth && s.auth.username) || '';
        if ($backendPass) $backendPass.value = (s.auth && s.auth.password) || '';
        updateStatusMode(s);
        updateSections();
      }
    });
  } catch(e){}

})();


