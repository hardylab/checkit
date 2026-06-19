/**
 * CheckIt Intent 类型定义
 *
 * 设计哲学(借鉴 harness-life Life.* 但简化):
 * - V3:rule.check() 直接返回 issue,CLI 直接处理(改文件/输出/退出码)
 * - V4:rule.check() emit "Rule.Found" intent,handler 链决定怎么处理
 *
 * 好处:
 * - handler 可插拔(报告 vs fix vs escalate 分开)
 * - intent 可审计 / 可回放 / 可 dedupe
 * - V3 规则无需重写,通过 adapter 自动转
 *
 * 6 种 Intent:
 * - Rule.Scan     — 入口,扫描一类文件
 * - Rule.Found    — 发现问题(由 rule.check() emit,handler 链处理)
 * - Rule.Fix      — 触发自动修复
 * - Rule.Ignore   — review-ignore 命中
 * - Rule.Escalate — 严重 issue 升级
 * - Rule.Report   — 最终输出
 */

import type { ReviewIssue, ReviewRule } from '@checkit/shared';

/** Intent 生命周期状态 */
export type IntentStatus = 'pending' | 'dispatched' | 'completed' | 'failed';

/** Intent 是不可变快照 */
export interface Intent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: IntentStatus;
  dependsOn: string[];
  attempts: number;
  result?: unknown;
  error?: string;
  createdAt: number;
  completedAt?: number;
  /** 用于 dedupe 的指纹 */
  fingerprint?: string;
}

// ─────────────── 6 种 payload 类型 ───────────────

export interface RuleScanPayload {
  ruleId: string;
  rule: ReviewRule | IntentEmittingRule;
  files: string[];
}

export interface RuleFoundPayload {
  ruleId: string;
  issue: ReviewIssue;
}

export interface RuleFixPayload {
  issueId: string;
  ruleId: string;
  issue: ReviewIssue;
}

export interface RuleIgnorePayload {
  issueId: string;
  ruleId: string;
  reason: 'review-ignore-header' | 'illegal-ignore' | 'manual';
}

export interface RuleEscalatePayload {
  issueId: string;
  ruleId: string;
  issue: ReviewIssue;
  reason: 'level-error' | 'fix-failed' | 'manual';
}

export interface RuleReportPayload {
  issues: ReviewIssue[];
  errors: number;
  warnings: number;
}

/** Intent-emittable rule(可以是 V3 rule,通过 adapter 包装) */
export interface IntentEmittingRule {
  id: string;
  /** 触发一次扫描,返回 scan intent id(可以发多条 Rule.Found) */
  scan(ctx: import('@checkit/shared').RuleContext): string[];
  /** 收到 Rule.Fix intent 时调用,返回是否修复成功 */
  fix?(intent: Intent<RuleFixPayload>): boolean;
  /** V3 原始 rule(若有,用于 adapter) */
  v3?: ReviewRule;
}

/** Handler 接收的 Context */
export interface HandlerContext {
  /** emit 新 Intent */
  emit: <P>(type: string, payload: P, options?: { fingerprint?: string; dependsOn?: string[] }) => string;
  /** 查询已 emit 的 Intent */
  getIntent: (id: string) => Intent | undefined;
  /** 按类型查(顺序) */
  getByType: (type: string) => Intent[];
  /** 标记 issue 为已忽略 */
  ignoreIssue: (fingerprint: string) => void;
  /** 检查 issue 是否已被忽略 */
  isIgnored: (fingerprint: string) => boolean;
  /** 当前 run 全局状态 */
  state: RunState;
  /** CLI 选项(autofix / recentMinutes 等) */
  options: RunOptions;
}

export interface RunOptions {
  autofix: boolean;
  recentMinutes?: number;
  reporter: 'stylish' | 'json' | 'silent';
}

export interface RunState {
  /** 已收集的活跃 issue(rule found 但未被 ignore) */
  activeIssues: Map<string, ReviewIssue>;
  /** 已忽略的 issue fingerprint */
  ignoredFingerprints: Set<string>;
  /** 当前 run 所有 intent(只读引用,完整数据在 engine) */
  allIntents: Intent[];
  /** 计数 */
  stats: { errors: number; warnings: number; infos: number; ignored: number };
}

/** Handler 是 async 函数,接收 Intent + Context */
export type IntentHandler<T = unknown> = (
  intent: Intent<T>,
  ctx: HandlerContext
) => void | Promise<void>;
