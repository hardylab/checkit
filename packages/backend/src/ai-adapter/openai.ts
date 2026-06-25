// packages/backend/src/ai-adapter/openai.ts — OpenAI / OpenAI-compatible adapter
//
// 调用 OpenAI Chat Completions API (https://api.openai.com/v1/chat/completions)。
// 通过 `baseUrl` 也可指向 Azure / Together / OpenRouter 等 OpenAI-compatible 服务。
//
// Auth:
// - apiKey: 显式传入(通常从 env OPENAI_API_KEY 读)
// - 或 env: process.env.OPENAI_API_KEY
//
// Model 默认 "gpt-4o-mini"。可覆盖(cfg.model)。

import type { AiAdapter, AdapterConfig, ChatContext, ChatReply, RuleSuggestion, PresetRecommendation } from './types.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 30_000;

const RULE_CATALOG = `
- plaintext-credentials (error): Ban hard-coded passwords / API keys / tokens in source.
- git-no-secrets-in-history (error): Scan last 50 commits for leaked credentials.
- gitignore-sensitive-required (error): Ensure .gitignore covers node_modules, .env, .env.*.
- git-no-large-files (error): Block files > 1 MB from git history.
- no-any-rule (error): Disallow 'any' type in TypeScript.
- no-console-log (warning): Disallow console.log in production code.
- no-magic-numbers (warning): Flag unexplained numeric literals.
- no-circular-dependency (error): Detect circular module imports.
- require-test-file (error): Every src file needs a matching test file.
- group-test-files (warning): Tests should live next to source, not in a separate tree.
- use-spec-coding (warning): Link tests to a spec/coding document.
- doc-pattern (warning): Each module needs a <name>.md documentation file.
- filename-naming-rule (warning): Enforce consistent filename conventions.
- utf8-encoding-required (warning): Source files must be valid UTF-8.
- tab-size-two-spaces (warning): Indent with 2 spaces, no tabs.
- okf-compliance (warning): ESLint + Prettier must be configured.
- env-var-check (warning): Flag hard-coded env vars; require env abstraction.
- function-size-limit (warning): Functions should not exceed N lines.
- many-conditions-rule (warning): Functions should not have too many branches.
- index-only-exports (warning): Barrel files only re-export; no logic.
- require-index-export (warning): Every directory must have an index.ts.
- require-tsconfig-no-emit (error): tsconfig must have noEmit (type-check only).
- require-tsconfig-one-way-references (warning): Module references follow one-way convention.
- spec-traceability-check (warning): Each spec must trace back to code.
- flow-naming-rule (warning): Naming convention for flow/controller/service files.
- entry-point-no-logic (warning): Top-level entry files must not contain logic.
- rule-structure (warning): Internal meta-rule for rule code quality.
- rule-self-check (error): Internal meta-rule — checks this CLI's own source.
`;

const PRESET_CATALOG = `
- security-baseline: Credential + git history + .gitignore + large-file checks. (官方)
- ts-strict: Full TypeScript strict mode: no-any, no-console-log, no-magic, module boundaries. (官方)
- module-boundaries: Module import direction + index-only exports + entry-point rules. (官方)
- file-hygiene: filename naming + utf-8 + tab size + doc pattern + no large files. (官方)
- test-coverage: Force test files + group tests + coding spec linkage. (官方)
- code-cleanup: function size + complex branches + magic numbers + tsconfig + no-console-log. (官方)
- config-safety: env-var check + .gitignore + OKF compliance. (官方)
- docs-quality: Mandatory doc files + filename naming linkage. (官方)
- flow-style: flow naming + entry-point + module flow consistency. (官方)
- freshness: recent file format + recent file lint-fix. (官方)
`;

const SYSTEM_PROMPT = `You are LintAny's assistant. The user is configuring code-quality rules for their project.

When the user describes what they want (security checks, TypeScript strict mode, formatting, etc.), respond with:

1. A short helpful reply (1-2 sentences) acknowledging what they need.
2. Up to 5 specific rule recommendations from this catalog:${RULE_CATALOG}
3. Optionally a bundled preset recommendation from:${PRESET_CATALOG}

Respond ONLY with valid JSON in this shape:
{
  "reply": "<1-2 sentence helpful reply>",
  "suggestions": [{ "id": "<rule-id>", "title": "<rule title>", "tldr": "<1-line why>" }],
  "recommendedSets": [{ "id": "<preset-id>", "name": "<preset name>", "description": "<1-line description>" }]
}

Only recommend rules/presets that genuinely match the user's request. If unsure, return fewer items. Never invent rule ids not in the catalog.`;

/**
 * Coerce LLM output into ChatReply. Robust to:
 * - extra text before/after JSON
 * - markdown ```json fences
 * - suggestions / recommendedSets as either object or array
 * - missing fields → empty arrays
 */
function parseReply(raw: string): ChatReply {
  // Pull the first JSON-looking object out of the response.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : raw;
  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { reply: raw.trim().slice(0, 400), suggestions: [], recommendedSets: [] };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(jsonMatch[0]); } catch {
    return { reply: raw.trim().slice(0, 400), suggestions: [], recommendedSets: [] };
  }
  const obj = parsed as { reply?: unknown; suggestions?: unknown; recommendedSets?: unknown };

  const reply = typeof obj.reply === 'string' ? obj.reply : '';

  const suggestions: RuleSuggestion[] = Array.isArray(obj.suggestions)
    ? (obj.suggestions as unknown[])
        .map((s): RuleSuggestion | null => {
          if (typeof s === 'string') return { id: s, title: s };
          if (typeof s === 'object' && s !== null) {
            const ss = s as { id?: unknown; title?: unknown; tldr?: unknown };
            if (typeof ss.id === 'string') {
              return { id: ss.id, title: typeof ss.title === 'string' ? ss.title : ss.id, tldr: typeof ss.tldr === 'string' ? ss.tldr : undefined };
            }
          }
          return null;
        })
        .filter((x): x is RuleSuggestion => x !== null)
    : [];

  const recommendedSets: PresetRecommendation[] = Array.isArray(obj.recommendedSets)
    ? (obj.recommendedSets as unknown[])
        .map((p): PresetRecommendation | null => {
          if (typeof p === 'string') return { id: p, name: p, description: '' };
          if (typeof p === 'object' && p !== null) {
            const pp = p as { id?: unknown; name?: unknown; description?: unknown };
            if (typeof pp.id === 'string') {
              return {
                id: pp.id,
                name: typeof pp.name === 'string' ? pp.name : pp.id,
                description: typeof pp.description === 'string' ? pp.description : '',
              };
            }
          }
          return null;
        })
        .filter((x): x is PresetRecommendation => x !== null)
    : [];

  return { reply, suggestions, recommendedSets };
}

export function makeOpenAIAdapter(cfg: AdapterConfig = {}): AiAdapter {
  // When baseUrl points at MiniMax (api.minimaxi.com), accept either
  // OPENAI_API_KEY or MINIMAX_API_KEY from the environment. Anywhere
  // else, OPENAI_API_KEY only.
  const isMiniMax = (cfg.baseUrl ?? '').includes('api.minimaxi.com');
  const envKey = isMiniMax
    ? (process.env.MINIMAX_API_KEY ?? process.env.OPENAI_API_KEY)
    : process.env.OPENAI_API_KEY;
  const apiKey = cfg.apiKey ?? envKey;
  const baseUrl = (cfg.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = cfg.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    id: 'openai',
    label: `OpenAI (${model})`,
    async chat(message: string, ctx: ChatContext): Promise<ChatReply> {
      if (!apiKey) {
        throw new Error(
          `openai adapter: missing API key. Set one of:\n` +
          `  - lintany config set ai.api_key sk-...\n` +
          `  - env var OPENAI_API_KEY=sk-...\n` +
          `Or switch to a different adapter: lintany config set ai.adapter local-keyword`,
        );
      }

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];
      if (ctx.history) {
        for (const h of ctx.history) {
          messages.push({ role: h.role, content: h.text });
        }
      }
      messages.push({ role: 'user', content: message });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          throw new Error(`openai adapter: HTTP ${resp.status} ${resp.statusText}\n${body.slice(0, 200)}`);
        }
        const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new Error(`openai adapter: unexpected response shape (no message.content)`);
        }
        return parseReply(content);
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          throw new Error(`openai adapter: request timed out after ${timeoutMs}ms`);
        }
        throw e;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
