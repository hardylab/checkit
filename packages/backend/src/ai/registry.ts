// spec:[spec](specs/backend/ai/registry.md)
import type { AIAgent } from './types';
import { ClaudeAgent } from './adapters/claude';
import { OpenCodeAgent } from './adapters/opencode';
import { HermesAgent } from './adapters/hermes';
import { OpenClawAgent } from './adapters/openclaw';

/**
 * 所有已知的 AI agent adapters
 *
 * 检测顺序(从前到后):opencode → claude → hermes → openclaw
 * - opencode: 实测 deepseek-v4-flash-free 17 秒跑通,推荐默认
 * - claude: 启动慢(1-2 分钟),在某些环境下失败
 * - hermes: 本机环境自带,但**默认禁用**(元编程风险)
 * - openclaw: OpenClaw 生态
 */
export const ALL_AGENTS: AIAgent[] = [
  new OpenCodeAgent(),
  new ClaudeAgent(),
  new HermesAgent(),
  new OpenClawAgent(),
];

export const AGENT_NAMES = ALL_AGENTS.map((a) => a.name);
