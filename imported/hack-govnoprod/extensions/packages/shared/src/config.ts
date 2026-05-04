import { z } from 'zod';

export const FeatureFlagsSchema = z.object({
  enableMock: z.boolean().default(true),
  enableInlineHints: z.boolean().default(false),
  enabledSites: z.array(z.string()).default(['chatgpt']),
});

export const SettingsSchemaV1 = z.object({
  version: z.literal(1),
  mode: z.enum(['mock', 'remote', 'openai']).default('mock'),
  baseUrl: z.string().url().or(z.literal('')).default(''),
  apiKey: z.string().default(''),
  model: z.string().default('gpt-5-nano'),
  autoAnalyzeOnPaste: z.boolean().default(false),
  maxLength: z.number().int().positive().default(2000),
  // top-level toggles
  blockOnHighRisk: z.boolean().default(false),
  piiGuardEnabled: z.boolean().default(true),
  flags: FeatureFlagsSchema.default({}),
});
export type SettingsV1 = z.infer<typeof SettingsSchemaV1>;

export type Settings = SettingsV1;
export const SettingsSchema = SettingsSchemaV1;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({ version: 1 });

// Callback-wrapped helpers to avoid relying on Promise API availability in MV3
function storageLocalGet<T = any>(keys: string | string[]): Promise<Record<string, T>> {
  return new Promise((resolve) => {
    try { (chrome.storage.local.get as any)(keys, (res: any) => resolve(res || {})); } catch { resolve({} as any); }
  });
}

function storageLocalSet(obj: Record<string, any>): Promise<void> {
  return new Promise((resolve) => {
    try { chrome.storage.local.set(obj, () => resolve()); } catch { resolve(); }
  });
}

export async function loadSettings(): Promise<Settings> {
  try {
    // Read ONLY from local for the single-browser/single-user scenario
    const raw = await storageLocalGet('settings');
    if (raw && raw.settings) return migrateSettings(raw.settings);
    // Migration path from legacy loose keys if present
    const legacy = await storageLocalGet<any>([
      'mode',
      'baseUrl',
      'apiKey',
      'aiAuditor_blockOnHighRisk',
      'aiAuditor_piiGuardEnabled',
    ]);
    const maybe = {
      version: 1 as const,
      mode: legacy.mode ?? 'mock',
      baseUrl: legacy.baseUrl ?? '',
      apiKey: legacy.apiKey ?? '',
      model: 'gpt-5-nano',
      autoAnalyzeOnPaste: false,
      maxLength: 2000,
      blockOnHighRisk: typeof legacy.aiAuditor_blockOnHighRisk === 'boolean' ? legacy.aiAuditor_blockOnHighRisk : false,
      piiGuardEnabled: typeof legacy.aiAuditor_piiGuardEnabled === 'boolean' ? legacy.aiAuditor_piiGuardEnabled : true,
      flags: { enableMock: (legacy.mode ?? 'mock') === 'mock', enableInlineHints: false, enabledSites: ['chatgpt'] },
    };
    const parsed = SettingsSchema.safeParse(maybe);
    if (parsed.success) {
      await saveSettings(parsed.data);
      return parsed.data;
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function migrateSettings(data: unknown): Settings {
  // Only V1 currently
  const v1 = SettingsSchemaV1.safeParse(data);
  if (v1.success) return v1.data;
  return DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings): Promise<void> {
  // Always persist to local. Attempt to persist to sync storage as a best-effort for cross-device restore.
  await storageLocalSet({ settings: next });
  try {
    if (chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.set === 'function') {
      chrome.storage.sync.set({ settings: next }, () => {});
    }
  } catch {
    // ignore sync errors
  }
}


