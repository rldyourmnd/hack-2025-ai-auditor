import type { AnalysisResult } from './types';
import { renderFindingsList } from '@extensions/ui';
import { MessageTypes } from '@extensions/messaging';

const $summary = document.getElementById('summary')!;
const $list = document.getElementById('list')!;
const $reanalyze = document.getElementById('reanalyze') as HTMLButtonElement | null;
const $inputPreview = document.getElementById('input-preview') as HTMLDivElement | null;
const $mode = document.getElementById('mode') as HTMLSelectElement | null;
const $apiBase = document.getElementById('apiBase') as HTMLInputElement | null;
const $apiKey = document.getElementById('apiKey') as HTMLInputElement | null;
const $saveConfig = document.getElementById('saveConfig') as HTMLButtonElement | null;
const $model = document.getElementById('model') as HTMLInputElement | null;
const $checkHealth = document.getElementById('checkHealth') as HTMLButtonElement | null;
const $healthStatus = document.getElementById('healthStatus') as HTMLDivElement | null;
const $statusLine = document.getElementById('statusLine') as HTMLDivElement | null;
const $piiGuard = document.getElementById('piiGuard') as HTMLInputElement | null;
const $blockHigh = document.getElementById('blockHigh') as HTMLInputElement | null;
const $inlineHints = document.getElementById('inlineHints') as HTMLInputElement | null;
const $siteList = document.getElementById('siteList') as HTMLDivElement | null;

function init() {
  chrome.storage.local.get(['settings'], (res) => {
    const settings = res?.settings;
    if ($mode) $mode.value = settings?.mode || 'mock';
    if ($statusLine) $statusLine.textContent = `Mode: ${settings?.mode === 'mock' ? 'Offline (local)' : settings?.mode === 'openai' ? 'OpenAI (direct)' : 'Remote (backend)'}`;
    if ($apiBase) $apiBase.value = settings?.baseUrl || '';
    if ($apiKey) $apiKey.value = settings?.apiKey || '';
    if ($model) $model.value = settings?.model || 'gpt-5-nano';
    if ($piiGuard) $piiGuard.checked = settings?.flags?.piiGuardEnabled ?? true;
    if ($blockHigh) $blockHigh.checked = settings?.blockOnHighRisk ?? false;
    if ($inlineHints) $inlineHints.checked = settings?.flags?.enableInlineHints ?? false;
    // sites allowlist
    const enabledSites = (settings?.flags?.enabledSites as string[] | undefined) || ['chatgpt'];
    if ($siteList) {
      const inputs = Array.from($siteList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
      for (const ip of inputs) {
        ip.checked = enabledSites.includes(ip.value);
      }
    }
    // re-run button removed per UI simplification; do not show last analysis
    if ($reanalyze) $reanalyze.remove();
    if ($summary) $summary.remove();
    if ($inputPreview) $inputPreview.remove();
    if ($saveConfig) {
      $saveConfig.addEventListener('click', async () => {
        const mode = $mode?.value || 'mock';
        const base = $apiBase?.value?.trim() || '';
        const key = $apiKey?.value?.trim() || '';
        const model = $model?.value?.trim() || 'gpt-5-nano';
        const enabledSites = $siteList ? Array.from($siteList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter(i=>i.checked).map(i=>i.value) : ['chatgpt'];
        // validation: remote requires base URL
        if (mode === 'remote' && !base) { if ($healthStatus) $healthStatus.textContent = 'Error: base URL required for remote mode'; return; }
        // validation: OpenAI direct requires API key
        if (mode === 'openai' && !key) { if ($healthStatus) $healthStatus.textContent = 'Error: API key required for OpenAI mode'; return; }

        const payload = {
          version: 1,
          mode,
          baseUrl: base,
          apiKey: key,
          model,
          autoAnalyzeOnPaste: false,
          maxLength: 2000,
          flags: {
            enableMock: mode === 'mock',
            enableInlineHints: $inlineHints?.checked ?? false,
            enabledSites,
          },
          // top-level toggles
          blockOnHighRisk: $blockHigh?.checked ?? false,
          piiGuardEnabled: $piiGuard?.checked ?? true,
        } as any;
        await new Promise<void>((resolve) => chrome.storage.local.set({ settings: payload }, () => resolve()));
        // inform background/content that settings changed
        try { chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); } catch {}
        if ($healthStatus) $healthStatus.textContent = 'Saved.';
        if ($statusLine) $statusLine.textContent = `Mode: ${mode === 'mock' ? 'Offline (local)' : mode === 'openai' ? 'OpenAI (direct)' : 'Remote (backend)'}`;
      });
    }
    if ($checkHealth) {
      $checkHealth.addEventListener('click', async () => {
        const mode = $mode?.value || 'mock';
        if ($healthStatus) $healthStatus.textContent = 'Checking...';
        try {
          if (mode === 'openai') {
            const key = $apiKey?.value?.trim();
            const resp = await fetch('https://api.openai.com/v1/models', { method: 'GET', headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' } });
            if ($healthStatus) $healthStatus.textContent = resp.ok ? 'OK • OpenAI' : `HTTP ${resp.status}`;
          } else {
            const base = $apiBase?.value?.trim() || '';
            if (!base) { if ($healthStatus) $healthStatus.textContent = 'No base URL'; return; }
            const resp = await fetch(base.replace(/\/$/, '') + '/healthz', { method: 'GET' , mode: 'cors' });
            if (resp.ok) {
              const j = await resp.json().catch(() => null);
              if ($healthStatus) $healthStatus.textContent = `OK • ${j?.status ?? 'ok'}`;
            } else {
              if ($healthStatus) $healthStatus.textContent = `HTTP ${resp.status}`;
            }
          }
        } catch (err:any) {
          if ($healthStatus) $healthStatus.textContent = `Err: ${String(err?.message || err)}`;
        }
      });
    }
  });
}

init();

function render(res?: AnalysisResult) {
  if (!res) { $summary.textContent = 'No data yet.'; $list.innerHTML = ''; return; }
  if (res.ok) {
    $summary.textContent = `Findings: ${res.findings.length}`;
  } else {
    $summary.textContent = `Error: ${res.error}`;
  }
  renderFindingsList($list, res as any);
}


