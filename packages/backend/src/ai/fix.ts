// spec:[spec](specs/backend/ai/fix.md)
import type { ReviewIssue } from '@checkit/shared';
import { ALL_AGENTS } from './registry';
import { pickFirstAvailable } from './detect';
import type { AIAgent, AgentContext, AgentResult } from './types';

export interface AIFixConfig {
  /** 用户指定 agent 名('claude' / 'opencode' / 'hermes' / 'openclaw') */
  agentName?: string;
  /** 自动选择时排除的 agent(默认排除 hermes) */
  excludeNames?: string[];
  /** 单次 AI 调用的超时(ms) */
  timeoutMs?: number;
  /** AI 修复后是否重新跑 check 验证 */
  verify?: boolean;
  /** 自定义 prompt(替换默认 buildFixPrompt) */
  customPrompt?: string;
}

export interface AIFixResult {
  /** issue 数量 */
  totalIssues: number;
  /** 成功修复数 */
  fixedCount: number;
  /** 失败数 */
  failedCount: number;
  /** 跳过的(不需要修 / 没 agent) */
  skippedCount: number;
  /** 选了哪个 agent */
  agentUsed?: string;
  /** 每个 issue 的处理详情 */
  details: Array<{
    issue: ReviewIssue;
    status: 'fixed' | 'failed' | 'skipped';
    agentOutput?: string;
    error?: string;
  }>;
}

/**
 * AI-Fix 主流程
 *
 * 1. 选定 agent(用户指定 / 自动选)
 * 2. 对每个 issue 调 agent 修
 * 3. (可选)重新跑 rule 验证
 *
 * 注意:verify 这里**不实现**(要 cli 接入,留给下一阶段)
 * 这里只负责"调 agent + 收集结果"。
 */
export async function aiFix(
  issues: ReviewIssue[],
  context: AgentContext,
  config: AIFixConfig = {}
): Promise<AIFixResult> {
  const result: AIFixResult = {
    totalIssues: issues.length,
    fixedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    details: [],
  };

  if (issues.length === 0) return result;

  // 1. 选 agent
  const agent = await selectAgent(config);
  if (!agent) {
    return {
      ...result,
      skippedCount: issues.length,
      details: issues.map((i) => ({
        issue: i,
        status: 'skipped' as const,
        error: 'No available AI agent',
      })),
    };
  }
  result.agentUsed = agent.name;

  // 2. 对每个 issue 调 agent
  for (const issue of issues) {
    const issueCtx: AgentContext = { ...context, issue };
    const prompt = config.customPrompt ?? buildFixPrompt(issue, issueCtx);

    const agentResult = await agent.run(prompt, issueCtx);
    if (agentResult.success) {
      result.fixedCount++;
      result.details.push({ issue, status: 'fixed', agentOutput: agentResult.output });
    } else {
      result.failedCount++;
      result.details.push({
        issue,
        status: 'failed',
        agentOutput: agentResult.output,
        error: agentResult.error,
      });
    }
  }

  return result;
}

/**
 * 选 agent
 */
async function selectAgent(config: AIFixConfig): Promise<AIAgent | null> {
  // 用户指定
  if (config.agentName) {
    const agent = ALL_AGENTS.find((a) => a.name === config.agentName);
    if (!agent) {
      throw new Error(
        `Unknown AI agent: ${config.agentName}. Available: ${ALL_AGENTS.map((a) => a.name).join(', ')}`
      );
    }
    if (!(await agent.isAvailable())) {
      throw new Error(`AI agent "${config.agentName}" is configured but not available on this machine`);
    }
    return agent;
  }

  // 自动选第一个可用的
  const first = await pickFirstAvailable(config.excludeNames);
  if (!first) {
    console.warn(
      '[ai-fix] No available AI agent. Install one of: claude / opencode / hermes / openclaw'
    );
  }
  return first ?? null;
}

/**
 * 构造 fix prompt
 *
 * 给 AI:issue 信息 + 文件上下文 + 明确的修复目标
 */
function buildFixPrompt(issue: ReviewIssue, context: AgentContext): string {
  return `You are fixing a CheckIt issue in a codebase.

ISSUE:
- File: ${issue.file ?? '<project>'}
- Line: ${issue.line ?? 'N/A'}
- Level: ${issue.level}
- Type: ${issue.type}
- Message: ${issue.issue}
- Expected: ${issue.expect ?? '(see CheckIt docs)'}

WORKSPACE: ${context.workspace}

YOUR TASK:
1. Read the file (or files related to the issue)
2. Fix the issue per the "Expected" guidance
3. Do NOT change unrelated code
4. Do NOT add new dependencies unless absolutely necessary

OUTPUT FORMAT:
- Briefly describe what you changed
- Show the diff or specific changes

Begin.`;
}
