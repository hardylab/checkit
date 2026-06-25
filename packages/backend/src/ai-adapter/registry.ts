// packages/backend/src/ai-adapter/registry.ts — adapter factory registry
//
// 调用方拿到 "openai" / "claude" / "local-keyword" 等 id 时,build 对应 adapter。
// 配置从 `~/.checkit/config.json` + env var + --adapter 参数合并。

import { getConfig } from '../config/global.js';
import { makeLocalKeywordAdapter } from './local-keyword.js';
import { makeOpenAIAdapter } from './openai.js';
import { makeClaudeAdapter } from './claude.js';
import type { AiAdapter, AdapterConfig } from './types.js';

export const KNOWN_ADAPTERS = ['local-keyword', 'openai', 'claude'] as const;
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

  const merged: AdapterConfig = {
    apiKey: cfg.apiKey ?? cfgApiKey,
    model: cfg.model ?? cfgModel,
    baseUrl: cfg.baseUrl ?? cfgBaseUrl,
    timeoutMs: cfg.timeoutMs,
  };

  switch (id) {
    case 'local-keyword':
      return makeLocalKeywordAdapter();
    case 'openai':
      return makeOpenAIAdapter(merged);
    case 'claude':
      return makeClaudeAdapter(merged);
    default:
      throw new Error(
        `unknown adapter: "${id}". Known: ${KNOWN_ADAPTERS.join(', ')}.\n` +
        `Set with: lintany config set ai.adapter <id>`,
      );
  }
}

/** Resolve the effective adapter id (from --adapter flag, config, or default). */
export function resolveAdapterId(flagValue: string | undefined): string {
  if (flagValue) return flagValue;
  try {
    const r = getConfig('ai.adapter');
    if (r.found && typeof r.value === 'string') return r.value;
  } catch {
    /* ignore */
  }
  return 'local-keyword';
}
