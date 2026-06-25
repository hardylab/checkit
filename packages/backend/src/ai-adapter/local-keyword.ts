// packages/backend/src/ai-adapter/local-keyword.ts
//
// 复用 src/chat/keyword-adapter.ts 的 chatReply,包成 AiAdapter shape。
// 这是默认 adapter — 无 API key 也能用。

import { chatReply as keywordChat } from '../chat/keyword-adapter.js';
import type { AiAdapter, ChatContext, ChatReply } from './types.js';

export function makeLocalKeywordAdapter(): AiAdapter {
  return {
    id: 'local-keyword',
    label: 'Local keyword (offline, no API key)',
    async chat(message: string, _ctx: ChatContext): Promise<ChatReply> {
      const r = await keywordChat(message, { adapter: 'local-keyword' });
      return {
        reply: r.reply,
        suggestions: r.suggestions,
        recommendedSets: r.recommendedSets,
      };
    },
  };
}
