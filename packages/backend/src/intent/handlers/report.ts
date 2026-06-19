/**
 * ReportHandler
 *
 * 监听 Rule.Found(不做任何事,dedupe + ignore 已经处理) 和 Rule.Report(最终输出)。
 *
 * 触发顺序:3(最后)— 注册在 Rule.Found type 但只对 Rule.Report 做事
 */

import type { Intent, IntentHandler, HandlerContext } from '../types';
import type { RuleFoundPayload, RuleReportPayload } from '../types';

export const reportHandler: IntentHandler<RuleFoundPayload | RuleReportPayload> = async (
  intent,
  ctx
) => {
  // 严格按 type 区分
  if (intent.type === 'Rule.Report') {
    const payload = intent.payload as RuleReportPayload;
    const { reporter } = ctx.options;
    const issues = Array.from(ctx.state.activeIssues.values());

    if (reporter === 'silent') {
      ctx.state.lastExitCode = issues.some((i) => i.level === 'error') ? 1 : 0;
      return;
    }

    if (reporter === 'json') {
      process.stdout.write(JSON.stringify(issues, null, 2) + '\n');
      ctx.state.lastExitCode = issues.some((i) => i.level === 'error') ? 1 : 0;
      return;
    }

    // stylish (default)
    if (issues.length === 0) {
      ctx.state.lastExitCode = 0;
      return;
    }
    const out = issues
      .map(
        (issue) =>
          `[${issue.level.toUpperCase()}] ${issue.type} - ${issue.issue} (${issue.file || 'project'}${
            issue.line ? ':' + issue.line : ''
          })`
      )
      .join('\n');
    process.stdout.write(out + '\n');
    ctx.state.lastExitCode = issues.some((i) => i.level === 'error') ? 1 : 0;
  }
  // Rule.Found:不做事(由 dedupe/ignore 处理)
};

// 扩展 RunState 类型(添加 lastExitCode)
declare module '../types' {
  interface RunState {
    lastExitCode?: number;
  }
}
