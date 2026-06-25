// packages/backend/src/ai-adapter/types.ts — AiAdapter interface
//
// Per MSP C1:所有 AI provider 实现这个接口。
// LocalKeywordAdapter 不调云端,纯本地;OpenAI/Claude 调云端。
// `lintany chat` 通过 adapter registry 选具体实现。

/** 用户消息 + 上下文(对话历史、当前 preset 等)。 */
export interface ChatContext {
  cwd: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** 当前 selected preset id(影响系统提示) */
  currentPreset?: string;
}

/** 推荐的具体规则(基于关键词 / 对话内容)。 */
export interface RuleSuggestion {
  id: string;
  title: string;
  tldr?: string;
}

/** 推荐的 preset。 */
export interface PresetRecommendation {
  id: string;
  name: string;
  description: string;
}

/** Adapter 返回的统一 shape(跟 LocalKeyword 同 shape,desktop /api/chat 兼容)。 */
export interface ChatReply {
  reply: string;
  suggestions: RuleSuggestion[];
  recommendedSets: PresetRecommendation[];
}

/**
 * 所有 AI provider 的统一接口。
 * - id:    registry key,小写("local-keyword" | "openai" | "claude" | ...)
 * - label: 用户可见显示名
 * - chat:  主入口。返回标准 ChatReply。
 */
export interface AiAdapter {
  readonly id: string;
  readonly label: string;
  chat(message: string, ctx: ChatContext): Promise<ChatReply>;
}

/** Adapter 构造参数(registry 注入)。 */
export interface AdapterConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;        // 允许自定义 endpoint(Ollama / Azure / proxy)
  timeoutMs?: number;
}

/** Adapter factory signature。 */
export type AdapterFactory = (cfg: AdapterConfig) => AiAdapter;
