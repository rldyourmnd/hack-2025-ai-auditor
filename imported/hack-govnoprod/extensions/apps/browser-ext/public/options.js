document.addEventListener('DOMContentLoaded', () => {
  const piiToggle = document.createElement('label'); piiToggle.textContent = 'Enable PII guard';
  const chk = document.createElement('input'); chk.type = 'checkbox'; chk.id = 'pii_guard_enabled';
  piiToggle.prepend(chk);
  const blockToggle = document.createElement('label'); blockToggle.textContent = 'Block on high risk';
  const chk2 = document.createElement('input'); chk2.type = 'checkbox'; chk2.id = 'block_on_high_risk';
  blockToggle.prepend(chk2);
  const container = document.querySelector('body');
  if (container) { container.insertBefore(piiToggle, container.firstChild); container.insertBefore(blockToggle, piiToggle.nextSibling); }

  function load() {
    try { chrome.storage.local.get(['settings'], (res) => {
      const s = res?.settings || {};
      chk.checked = typeof s.piiGuardEnabled === 'boolean' ? s.piiGuardEnabled : true;
      chk2.checked = typeof s.blockOnHighRisk === 'boolean' ? s.blockOnHighRisk : true;
    }); } catch (err) {}
  }
  function save() {
    try {
      chrome.storage.local.get(['settings'], (res) => {
        const s = res?.settings || {};
        s.piiGuardEnabled = chk.checked;
        s.blockOnHighRisk = chk2.checked;
        chrome.storage.local.set({ settings: s }, () => { alert('Saved'); });
      });
    } catch (err) { alert('Save error'); }
  }
  load();
  const saveBtn = document.getElementById('save'); if (saveBtn) saveBtn.addEventListener('click', save);
});

// Options page script (external to satisfy CSP)
(function(){
  const LOG = 'AI Auditor (options)';
  const $ = (id) => document.getElementById(id);
  const modeEl = $('mode');
  const baseUrlEl = $('baseUrl');
  const apiKeyEl = $('apiKey');
  const modelEl = $('model');
  const saveBtn = $('save');

  function log(){ try { console.log.apply(console, [LOG].concat(Array.from(arguments))); } catch{} }

  function defaultSettings(){
    return { version:1, mode:'mock', baseUrl:'', apiKey:'', model:'gpt-5-nano', autoAnalyzeOnPaste:false, maxLength:2000, flags:{ enableMock:true } };
  }

  function buildFromUI(){
    const mode = (modeEl && modeEl.value) || 'mock';
    const baseUrl = (baseUrlEl && baseUrlEl.value.trim()) || '';
    const apiKey = (apiKeyEl && apiKeyEl.value.trim()) || '';
    const model = (modelEl && modelEl.value.trim()) || 'gpt-5-nano';
    return { version:1, mode, baseUrl, apiKey, model, autoAnalyzeOnPaste:false, maxLength:2000, flags:{ enableMock: mode === 'mock' } };
  }

  function load(){
    try{
      chrome.storage.local.get(['settings'], (res) => {
        const s = res && res.settings ? res.settings : defaultSettings();
        log('loaded settings', s);
        if (modeEl) modeEl.value = s.mode || 'mock';
        if (baseUrlEl) baseUrlEl.value = s.baseUrl || '';
        if (apiKeyEl) apiKeyEl.value = s.apiKey || '';
        if (modelEl) modelEl.value = s.model || 'gpt-5-nano';
      });
    } catch(e){ log('load error', e); }
  }

  function showAlert(msg){
    try { alert(msg); } catch {}
  }

  function save(){
    const cfg = buildFromUI();
    if (cfg.mode === 'openai' && !cfg.apiKey) { showAlert('OpenAI mode requires an API key'); return; }
    log('saving', cfg);
    try{
      chrome.storage.local.set({ settings: cfg }, () => {
        chrome.storage.local.get(['settings'], (res) => {
          const stored = res && res.settings ? res.settings : null;
          log('stored back', stored);
          try { if (JSON.stringify(stored) !== JSON.stringify(cfg)) { showAlert('Failed to save settings (local).'); return; } } catch(e) { log('stringify error', e); }
          try { chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); } catch(e){}
          showAlert('Saved');
        });
      });
    } catch(e){ log('save error', e); showAlert('Save error'); }
  }

  function autoSave(){
    const cfg = buildFromUI();
    if (cfg.mode === 'openai' && !cfg.apiKey) return;
    try { chrome.storage.local.set({ settings: cfg }, () => { try{ chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); }catch{} }); } catch(e) { log('autosave error', e); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    if (saveBtn) saveBtn.addEventListener('click', save);
    if (modeEl) modeEl.addEventListener('change', autoSave);
    if (baseUrlEl) baseUrlEl.addEventListener('input', autoSave);
    if (apiKeyEl) apiKeyEl.addEventListener('input', autoSave);
    if (modelEl) modelEl.addEventListener('input', autoSave);
  });

})();


