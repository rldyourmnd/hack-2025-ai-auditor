export * from './siteAdapter';
export { ChatGPTAdapter } from './chatgpt';
export { ClaudeAdapter } from './claude';
export { GrokAdapter } from './grok';
export { GeminiAdapter } from './gemini';
export { DeepSeekAdapter } from './deepseek';
export { QWENAdapter } from './qwen';
export { PerplexityAdapter } from './perplexity';

import type { SiteAdapter } from './siteAdapter';
import { ChatGPTAdapter as ChatGPT } from './chatgpt';
import { ClaudeAdapter as Claude } from './claude';
import { GrokAdapter as Grok } from './grok';
import { GeminiAdapter as Gemini } from './gemini';
import { DeepSeekAdapter as DeepSeek } from './deepseek';
import { QWENAdapter as QWEN } from './qwen';
import { PerplexityAdapter as Perplexity } from './perplexity';

export const adapters: SiteAdapter[] = [ ChatGPT, Claude, Grok, Gemini, DeepSeek, QWEN, Perplexity ];
export function getActiveAdapter(): SiteAdapter | null {
  for (const a of adapters) if (a.matches(location)) return a;
  return null;
}


