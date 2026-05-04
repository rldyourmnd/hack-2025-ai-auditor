import { loadSettings, saveSettings, SettingsSchema } from '@extensions/shared';

const modeEl = document.getElementById('mode') as HTMLSelectElement;
const baseUrlEl = document.getElementById('baseUrl') as HTMLInputElement;
const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const analysisModeEl = document.getElementById('analysisMode') as HTMLSelectElement | null;
const modelEl = document.getElementById('model') as HTMLInputElement | null;

function buildSettingsFromUI() {
  const mode = modeEl.value;
  const baseUrl = baseUrlEl.value.trim();
  const apiKey = apiKeyEl.value.trim();
  const model = (modelEl?.value || 'gpt-5-nano').trim();
  const next: any = {
    version: 1,
    mode,
    baseUrl,
    apiKey,
    model,
    autoAnalyzeOnPaste: false,
    maxLength: 2000,
    flags: { enableMock: mode === 'mock' },
    analysisMode: (analysisModeEl?.value === 'deep' ? 'deep' : 'fast'),
  };
  return next;
}

async function autoSaveIfPossible() {
  const candidate = buildSettingsFromUI();
  const parsed = SettingsSchema.safeParse(candidate);
  if (parsed.success) {
    // Do not auto-save an OpenAI mode without an API key
    if ((parsed.data as any).mode === 'openai' && !(parsed.data as any).apiKey) return;
    await saveSettings(parsed.data);
    try { chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); } catch {}
  }
}

(async function init() {
  const s = await loadSettings();
  modeEl.value = s.mode;
  baseUrlEl.value = s.baseUrl;
  apiKeyEl.value = s.apiKey;
  if (modelEl) modelEl.value = (s as any).model || 'gpt-5-nano';
  if (analysisModeEl) analysisModeEl.value = (s as any).analysisMode === 'deep' ? 'deep' : 'fast';
})();

saveBtn.addEventListener('click', async () => {
  const apiKey = apiKeyEl.value.trim();
  const mode = modeEl.value;
  // validation: OpenAI direct requires API key
  if (mode === 'openai' && !apiKey) { alert('OpenAI mode requires an API key'); return; }

  const parsed = SettingsSchema.safeParse({
    version: 1,
    mode: modeEl.value,
    baseUrl: baseUrlEl.value.trim(),
    apiKey: apiKeyEl.value.trim(),
    model: (modelEl?.value || 'gpt-5-nano').trim(),
    autoAnalyzeOnPaste: false,
    maxLength: 2000,
    flags: { enableMock: modeEl.value === 'mock' },
    analysisMode: (analysisModeEl?.value === 'deep' ? 'deep' : 'fast'),
  });
  if (!parsed.success) {
    alert('Invalid settings');
    return;
  }
  await saveSettings(parsed.data);
  try { chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' }); } catch {}
  alert('Saved');
});

// Simple auto-save on any input change to keep settings in sync
modeEl.addEventListener('change', autoSaveIfPossible);
baseUrlEl.addEventListener('input', autoSaveIfPossible);
apiKeyEl.addEventListener('input', autoSaveIfPossible);
modelEl?.addEventListener('input', autoSaveIfPossible);

