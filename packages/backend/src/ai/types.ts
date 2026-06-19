// spec:[spec](specs/backend/ai/agents.md)
import type { ReviewIssue } from '@checkit/shared';

/**
 * AI Agent adapter interface
 *
 * 不同 AI agent(Claude Code / OpenCode / Hermes / OpenClaw / ...)
 * 通过实现这个接口接入 checkit 的 AI-Fix 流程。
 *
 * 设计原则:
 * - 同步 CLI 风格:agent 接受 prompt string,返回 string 结果
 * - 隔离:每个 agent 自己处理网络/认证/token,不污染 checkit
 * - 可测:isAvailable() 必须可测(test 时 mock)
 */

/**
 * 单次 agent 调用的上下文
 *
 * - workspace:agent 应该在哪个目录工作(checkit 通常是 rule 所在目录)
 * - file:可选,告诉 agent 重点关注哪个文件
 * - 额外上下文:issues(本次要修的)
 */
export interface AgentContext {
  workspace: string;
  file?: string;
  issue?: ReviewIssue;
  /** 自由字段,agent 自己用 */
  [key: string]: unknown;
}

/**
 * agent 单次运行结果
 */
export interface AgentResult {
  /** agent 名 */
  agent: string;
  /** 是否成功 */
  success: boolean;
  /** agent 原始输出(可能含 patch / 命令 / 错误) */
  output: string;
  /** 错误信息(success=false 时) */
  error?: string;
  /** 耗时 ms */
  durationMs: number;
  /** 退出码(0=成功) */
  exitCode: number;
}

/**
 * Agent adapter
 *
 * 实现者:
 * - src/ai/adapters/claude.ts     — Claude Code CLI
 * - src/ai/adapters/opencode.ts   — OpenCode CLI
 * - src/ai/adapters/hermes.ts     — Hermes Agent CLI
 * - src/ai/adapters/openclaw.ts   — OpenClaw
 */
export interface AIAgent {
  /** agent 名(用户配置里写这个) */
  name: string;
  /** 显示名(给人类看) */
  displayName: string;
  /** 检测本机是否装了这个 agent */
  isAvailable(): Promise<boolean>;
  /** 运行 prompt */
  run(prompt: string, context: AgentContext): Promise<AgentResult>;
}
