// packages/backend/src/ai-adapter/registry.ts — adapter factory registry
//
// 调用方拿到 "openai" / "claude" / "local-keyword" 等 id 时,build 对应 adapter。
// 配置从 `~/.checkit/config.json` + env var + --adapter 参数合并。

import { getConfig } from '../config/global.js';
import { makeLocalKeywordAdapter } from './local-keyword.js';
import { makeOpenAIAdapter } from './openai.js';
import { makeClaudeAdapter } from './claude.js';
import type { AiAdapter, AdapterConfig } from './types.js';

// MiniMax API (https://api.minimaxi.com) is OpenAI-compatible.
// Default baseUrl ends in /v1 so it concatenates cleanly with the path
// used by the OpenAI adapter (`/chat/completions`).
const MINIMAX_BASE_URL = 'https://api.minimaxi.com/v1';
const MINIMAX_MODEL = 'MiniMax-M3';

export const KNOWN_ADAPTERS = ['local-keyword', 'openai', 'claude', 'minimax'] as const;
export type KnownAdapterId = typeof KNOWN_ADAPTERS[number];

export function isKnownAdapter(id: string): id is KnownAdapterId {
  return (KNOWN_ADAPTERS as readonly string[]).includes(id);
}

/**
 * Build an adapter by id.
 *
 * AdapterConfig 从以下来源合并(后者覆盖前者):
 *   1. 显式传入的 cfg
 *   2. ~/.checkit/config.json (ai.api_key / ai.model / ai.base_url)
 *   3. env var (OPENAI_API_KEY / ANTHROPIC_API_KEY 等)
 *   4. 对 minimax id:默认 baseUrl + model(可被 cfg/config 覆盖)
 *
 * 注意:env var 在各 adapter 内部读取,这里只读 config.json。
 */
export function getAdapter(id: string, cfg: AdapterConfig = {}): AiAdapter {
  // Pull ai.* from global config (best-effort — ignore if missing).
  let cfgApiKey: string | undefined;
  let cfgModel: string | undefined;
  let cfgBaseUrl: string | undefined;
  try {
    const k = getConfig('ai.api_key');
    if (k.found && typeof k.value === 'string') cfgApiKey = k.value;
    const m = getConfig('ai.model');
    if (m.found && typeof m.value === 'string') cfgModel = m.value;
    const b = getConfig('ai.base_url');
    if (b.found && typeof b.value === 'string') cfgBaseUrl = b.value;
  } catch {
    /* config file missing/corrupt — skip */
  }

  switch (id) {
    case 'local-keyword':
      return makeLocalKeywordAdapter();
    case 'openai':
      return makeOpenAIAdapter({
        apiKey: cfg.apiKey ?? cfgApiKey,
        model: cfg.model ?? cfgModel,
        baseUrl: cfg.baseUrl ?? cfgBaseUrl,
        timeoutMs: cfg.timeoutMs,
      });
    case 'claude':
      return makeClaudeAdapter({
        apiKey: cfg.apiKey ?? cfgApiKey,
        model: cfg.model ?? cfgModel,
        baseUrl: cfg.baseUrl ?? cfgBaseUrl,
        timeoutMs: cfg.timeoutMs,
      });
    case 'minimax':
      // MiniMax uses OpenAI-compatible API; reuse the OpenAI adapter.
      // Defaults: baseUrl = https://api.minimaxi.com/v1, model = MiniMax-M3.
      return makeOpenAIAdapter({
        apiKey: cfg.apiKey ?? cfgApiKey,
        model: cfg.model ?? cfgModel ?? MINIMAX_MODEL,
        baseUrl: cfg.baseUrl ?? cfgBaseUrl ?? MINIMAX_BASE_URL,
        timeoutMs: cfg.timeoutMs,
      });
    default:
      // Unknown adapter id — treat as OpenAI-compatible (covers custom
      // providers the user typed in via the Settings modal: deepseek,
      // doubao, moonshot, etc., all of which expose /v1/chat/completions
      // style endpoints). We use the configured baseUrl + apiKey + model
      // verbatim. Falls through to MiniMax defaults if no baseUrl.
      return makeOpenAIAdapter({
        apiKey: cfg.apiKey ?? cfgApiKey,
        model: cfg.model ?? cfgModel,
        baseUrl: cfg.baseUrl ?? cfgBaseUrl,
        timeoutMs: cfg.timeoutMs,
      });
  }
}

/** Resolve the effective adapter id.
 *
 * Resolution order (first hit wins):
 *   1. --adapter flag (explicit)
 *   2. ai.adapter in ~/.checkit/config.json
 *   3. MINIMAX_API_KEY or OPENAI_API_KEY env → default to "minimax" (or "openai" if user prefers)
 *   4. "local-keyword" (offline fallback)
 *
 * This way `lintany chat "..."` Just Works™ for users who have a MiniMax
 * or OpenAI key in their environment, while offline users still get
 * useful keyword-based suggestions.
 */
export function resolveAdapterId(flagValue: string | undefined): string {
  if (flagValue) return flagValue;
  try {
    const r = getConfig('ai.adapter');
    if (r.found && typeof r.value === 'string') return r.value;
  } catch {
    /* ignore */
  }
  // Env-var auto-promotion: if a cloud key is present, use it. Prefer
  // MiniMax since it's our default provider.
  if (process.env.MINIMAX_API_KEY) return 'minimax';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'local-keyword';
}
