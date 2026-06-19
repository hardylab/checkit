/**
 * DedupeHandler
 *
 * 监听 Rule.Found,按 fingerprint 合并重复 issue。
 *
 * 触发顺序:1(必须第一个,后续 handler 看到的是 dedupe 后的结果)
 *
 * 行为:
 * - 计算 fingerprint(ruleId::file::line)
 * - 如果 fingerprint 已存在 → 标记后续为 duplicate,不加 activeIssues
 * - 否则 → 加到 activeIssues
 */

import type { Intent, IntentHandler, HandlerContext } from '../types';
import type { RuleFoundPayload } from '../types';
import { fingerprintOf } from '../engine';

export const dedupeHandler: IntentHandler<RuleFoundPayload> = async (
  intent,
  ctx
) => {
  const { ruleId, issue } = intent.payload;
  const fp = fingerprintOf(ruleId, issue);

  // 用 fingerprint 标记 intent 本身(供后续 handler / 调试)
  intent.fingerprint = fp;

  // 检查是否重复
  if (ctx.isIgnored(fp)) {
    // 已忽略(包括 dedupe 标记)— 跳过
    return;
  }
  if (ctx.state.activeIssues.has(fp)) {
    // 重复,不加入 activeIssues(但不忽略,让 ReportHandler 知道有重复)
    ctx.state.stats.ignored++; // 用 ignored 统计 dedupe
    return;
  }

  // 首次出现
  ctx.state.activeIssues.set(fp, issue);

  // 统计
  if (issue.level === 'error') ctx.state.stats.errors++;
  else if (issue.level === 'warning') ctx.state.stats.warnings++;
  else ctx.state.stats.infos++;
};
