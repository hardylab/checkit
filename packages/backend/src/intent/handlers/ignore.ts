/**
 * IgnoreHandler
 *
 * 监听 Rule.Found,检查文件头部的 `review-ignore:` 指令。
 *
 * 触发顺序:2(dedupe 之后)
 *
 * 行为:
 * - 解析每个 .ts/.tsx/.js/.jsx 文件头部的 `review-ignore: rule-a, rule-b`
 * - 如果某 rule 在 ignore 列表中:
 *   - 若 rule.ignorable === true → 忽略(从 activeIssues 移除)
 *   - 若 rule.ignorable === false → 抛"非法 ignore"错误(也加到 activeIssues 作为 error)
 * - 缓存 review-ignore map 到 ctx.state(避免每次重复读文件)
 *
 * 注:此 handler 是简化版,V3 的 review-ignore map 由 CLI 在 rule 跑前预先构建并注入。
 * V5 改造后,IgnoreHandler 自己读文件 + 解析 header。
 */

import type { Intent, IntentHandler, HandlerContext } from '../types';
import type { RuleFoundPayload, RuleIgnorePayload } from '../types';
import { fingerprintOf } from '../engine';

export interface IgnoreHandlerOptions {
  /**
   * 注入 review-ignore map(由 CLI 预先读好)
   * map<relativeFilePath, set<ruleId>>
   */
  reviewIgnoreMap?: Record<string, Set<string>>;
  /**
   * rule 是否 ignorable(name → boolean)
   */
  ruleIgnorable?: Record<string, boolean>;
}

export function createIgnoreHandler(
  opts: IgnoreHandlerOptions = {}
): IntentHandler<RuleFoundPayload> {
  const { reviewIgnoreMap = {}, ruleIgnorable = {} } = opts;

  return async (intent, ctx) => {
    const { ruleId, issue } = intent.payload;
    const fp = fingerprintOf(ruleId, issue);

    // 已 dedupe 跳过的或非活跃 issue,不处理
    if (!ctx.state.activeIssues.has(fp)) return;

    const rel = issue.file;
    if (!rel) return; // 项目级 issue 不忽略

    const ignoreIds = reviewIgnoreMap[rel];
    if (!ignoreIds) return;
    if (!ignoreIds.has(ruleId)) return;

    const ignorable = ruleIgnorable[ruleId] ?? false;

    if (ignorable) {
      // 合法 ignore:从 activeIssues 移除
      ctx.state.activeIssues.delete(fp);
      ctx.state.ignoredFingerprints.add(fp);
      ctx.state.stats.errors = Math.max(0, ctx.state.stats.errors - 1);
      ctx.state.stats.warnings = Math.max(0, ctx.state.stats.warnings - 1);
      ctx.state.stats.ignored++;

      // emit Rule.Ignore(供审计)
      ctx.emit<RuleIgnorePayload>('Rule.Ignore', {
        issueId: fp,
        ruleId,
        reason: 'review-ignore-header',
      });
    } else {
      // 非法 ignore:加 error
      const errorIssue = {
        type: 'structure' as const,
        module: issue.module,
        file: rel,
        issue: `该文件声明 review-ignore 以忽略规则 '${ruleId}'，但该规则不可忽略（ignorable=false）`,
        expect: `移除文件头部的 review-ignore 对 '${ruleId}' 的配置，或将规则声明为 ignorable 后再使用忽略。`,
        level: 'error' as const,
        fixable: false,
      };
      ctx.state.activeIssues.set(fp + '::illegal', errorIssue);
      ctx.state.stats.errors++;
    }
  };
}

/**
 * 默认 ignore handler(空配置,允许自定义)
 */
export const ignoreHandler = createIgnoreHandler();
