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
      // dev 模式:0 issue 输出"通过"提示(普通模式保持静默——issue=0 是常态)
      if (ctx.options.dev) {
        process.stdout.write('✅ checkit self-check passed — every rule has docs + ReviewRule contract + OKF frontmatter\n');
      }
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
    // dev 模式:在 issue 列表前加 banner(让 CI 日志一眼能区分 dev vs user)
    const prefix = ctx.options.dev ? '❌ checkit self-check FAILED:\n' : '';
    process.stdout.write(prefix + out + '\n');
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
