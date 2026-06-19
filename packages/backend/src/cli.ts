#!/usr/bin/env tsx
/**
 * CheckIt CLI
 *
 * 流程(类 ESLint):
 * 1. 解析 argv(支持 --config / --rule / --ignore / --fix / --recent / targetPath)
 * 2. 加载 checkit.config.{json,yaml,js,ts}(从 cwd 向上找 / 或 --config 指定)
 * 3. 解析 extends(preset 包 + 相对路径)
 * 4. 加载 .checkitignore
 * 5. glob 收集文件 → 应用 ignore
 * 6. 实例化每条 rule → 跑 check → 应用 review-ignore → 跑 fix(若 --fix)
 * 7. 报告 issues
 */

import path from 'path';
import { glob } from 'glob';
import type { ReviewRule, RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';

import { loadFullConfig, type ResolvedConfig, type ResolvedRuleEntry } from './config';

export interface CLIOptions {
  cwd?: string;
  targetPath?: string;
  shouldFix?: boolean;
  recentMinutes?: number | undefined;
  configPath?: string | null;
  cliRules?: Record<string, 'off' | 'warn' | 'error'>;
  cliIgnorePatterns?: string[];
  argv?: string[];
  v4?: boolean;
  json?: boolean;
}

export function handleFatalError(e: unknown) {
  console.error('Fatal error:', e);
  process.exit(1);
}

/**
 * 解析 argv 成结构化 CLI 参数
 */
function parseArgs(args: string[]): {
  targetPath: string;
  shouldFix: boolean;
  recentMinutes: number | undefined;
  configPath: string | null;
  cliRules: Record<string, 'off' | 'warn' | 'error'>;
  cliIgnorePatterns: string[];
  v4: boolean;
  json: boolean;
} {
  const shouldFix = args.includes('--fix');
  const v4 = args.includes('--v4');
  const json = args.includes('--json');

  // --recent [N]
  const recentIndex = args.indexOf('--recent');
  let recentMinutes: number | undefined;
  if (recentIndex !== -1) {
    const val = args[recentIndex + 1];
    if (val && !val.startsWith('--') && !isNaN(Number(val))) {
      recentMinutes = Number(val);
    } else {
      recentMinutes = 60;
    }
  }

  // --config <path>
  const configIndex = args.indexOf('--config');
  let configPath: string | null = null;
  if (configIndex !== -1) {
    const val = args[configIndex + 1];
    if (val && !val.startsWith('--')) {
      configPath = val;
    }
  }

  // --rule <ruleId=level> (可多次)
  const cliRules: Record<string, 'off' | 'warn' | 'error'> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rule') {
      const val = args[i + 1];
      if (val && val.includes('=')) {
        const [ruleId, level] = val.split('=');
        if (level === 'off' || level === 'warn' || level === 'error') {
          cliRules[ruleId] = level;
        }
      }
      i++;
    }
  }

  // --ignore <pattern> (可多次)
  const cliIgnorePatterns: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ignore') {
      const val = args[i + 1];
      if (val && !val.startsWith('--')) {
        cliIgnorePatterns.push(val);
      }
      i++;
    }
  }

  // targetPath:第一个非 flag、非 --X=Y 值的参数
  const targetPath =
    args.find(
      (arg) =>
        !arg.startsWith('--') &&
        !(!isNaN(Number(arg)) && args[args.indexOf(arg) - 1] === '--recent')
    ) || '.';

  return { targetPath, shouldFix, recentMinutes, configPath, cliRules, cliIgnorePatterns, v4, json };
}

export async function runCLI(options?: CLIOptions) {
  const cwd = options?.cwd ?? process.cwd();
  const projectRoot = cwd;
  const args = options?.argv ?? process.argv.slice(2);

  // 1. parseArgs(仅当没传 options 时从 argv 解)
  let targetPathArg: string;
  let shouldFix: boolean;
  let recentMinutes: number | undefined;
  let configPath: string | null;
  let cliRules: Record<string, 'off' | 'warn' | 'error'>;
  let cliIgnorePatterns: string[];
  let v4: boolean;
  let json: boolean;

  if (options?.argv || options?.targetPath !== undefined || options?.shouldFix !== undefined) {
    // 从 argv 解
    const parsed = parseArgs(options?.argv ?? args);
    targetPathArg = options?.targetPath ?? parsed.targetPath;
    shouldFix = options?.shouldFix ?? parsed.shouldFix;
    recentMinutes = options?.recentMinutes ?? parsed.recentMinutes;
    configPath = options?.configPath ?? parsed.configPath;
    cliRules = options?.cliRules ?? parsed.cliRules;
    cliIgnorePatterns = options?.cliIgnorePatterns ?? parsed.cliIgnorePatterns;
    v4 = options?.v4 ?? parsed.v4;
    json = options?.json ?? parsed.json;
  } else {
    targetPathArg = options?.targetPath ?? '.';
    shouldFix = options?.shouldFix ?? false;
    recentMinutes = options?.recentMinutes;
    configPath = options?.configPath ?? null;
    cliRules = options?.cliRules ?? {};
    cliIgnorePatterns = options?.cliIgnorePatterns ?? [];
    v4 = options?.v4 ?? false;
    json = options?.json ?? false;
  }

  const targetPath = path.resolve(cwd, targetPathArg);
  const targetName = path.basename(targetPath);

  // 2a. 处理 --config 短名(.checkit/strict 等)
  let resolvedConfigPath: string | null = null;
  if (configPath) {
    const { resolveExplicitConfig } = await import('./config/find');
    resolvedConfigPath = resolveExplicitConfig(configPath, cwd);
  }

  // 2b. 加载完整 config(含 extends + ignore + CLI 覆盖)
  const { config, ignore } = await loadFullConfig(cwd, {
    configPath: resolvedConfigPath,
    cliRules,
    cliIgnorePatterns,
  });

  // 3. 如果 config 完全空(无 rules),fallback 到 normalParadigm(向后兼容)
  let resolvedRules: ResolvedRuleEntry[] = config.rules;
  if (resolvedRules.length === 0) {
    resolvedRules = await loadFallbackRules();
  }

  // 4. glob 收集文件
  let files = await glob('**/*', {
    cwd: targetPath,
    nodir: true,
  });

  // 应用 .checkitignore + config.ignorePatterns
  files = files.filter((f) => {
    // glob 内置 ignore(基础防御)
    if (f.includes('node_modules/') || f.includes('.git/') || f.includes('dist/')) {
      return false;
    }
    // .checkitignore + config ignorePatterns
    return !ignore.matches(f);
  });

  // --recent
  if (recentMinutes !== undefined) {
    const cutoff = Date.now() - recentMinutes * 60 * 1000;
    files = files.filter((f) => {
      const abs = path.join(targetPath, f);
      try {
        const s = fs.statSync(abs);
        return s.mtimeMs >= cutoff || s.birthtimeMs >= cutoff;
      } catch {
        return false;
      }
    });
  }

  const context: RuleContext = {
    cwd,
    projectRoot,
    targetPath,
    targetName,
    targetType: 'project',
    files,
    autoFix: shouldFix,
  };

  const allIssues: ReviewIssue[] = [];
  const illegalIgnoreMarker = new Set<string>();

  // 5. 构建 review-ignore map(file header 指令)
  const reviewIgnoreMap = buildReviewIgnoreMap(files, targetPath);

  // 6. 实例化所有 resolved rules
  const standaloneRules: Array<{ rule: ReviewRule; entry: ResolvedRuleEntry }> = [];
  const flowRules: Record<
    string,
    Array<{ rule: ReviewRule; entry: ResolvedRuleEntry }>
  > = {};

  for (const entry of resolvedRules) {
    try {
      const rule = new entry.RuleCtor(entry.config.options);
      rule.id = rule.id || entry.id;
      if (rule.flow) {
        if (!flowRules[rule.flow.key]) flowRules[rule.flow.key] = [];
        flowRules[rule.flow.key].push({ rule, entry });
      } else {
        standaloneRules.push({ rule, entry });
      }
    } catch (e) {
      console.error(`Failed to instantiate rule ${entry.id}:`, e);
    }
  }

  // 7. 跑 rule
  const runRule = ({
    rule,
    entry,
  }: {
    rule: ReviewRule;
    entry: ResolvedRuleEntry;
  }) => {
    if (!rule || typeof rule.check !== 'function') return [];
    try {
      let issues = rule.check(context);
      // 应用 rule 配置的 level(覆盖 rule 默认 level)
      if (entry.config.level) {
        issues = issues.map((i) => ({ ...i, level: entry.config.level as ReviewIssue['level'] }));
      }
      // 应用 review-ignore 过滤
      const filtered: ReviewIssue[] = [];
      for (const i of issues) {
        const rel = i.file;
        const ignoreIds = rel ? reviewIgnoreMap[rel] : undefined;
        const wantsIgnore = !!ignoreIds && ignoreIds.includes(rule.id);
        if (wantsIgnore) {
          if (rule.ignorable) {
            continue;
          } else {
            const key = `${rel || ''}::${rule.id}`;
            if (!illegalIgnoreMarker.has(key)) {
              illegalIgnoreMarker.add(key);
              filtered.push({
                type: 'structure',
                module: context.targetName,
                file: rel,
                issue: `该文件声明 review-ignore 以忽略规则 '${rule.id}'，但该规则不可忽略（ignorable=false）`,
                expect: `移除文件头部的 review-ignore 对 '${rule.id}' 的配置，或将规则声明为 ignorable 后再使用忽略。`,
                level: 'error',
                fixable: false,
              });
            }
            filtered.push(i);
          }
        } else {
          filtered.push(i);
        }
      }

      if (filtered.length > 0) {
        // 给每个 issue 注入 data.ruleId(供 V4 intent engine 区分来源)
        const stamped = filtered.map((i) => ({
          ...i,
          data: { ...(i.data ?? {}), ruleId: rule.id },
        }));
        allIssues.push(...stamped);

        // 应用 fix
        const effectiveAutofix =
          entry.config.autofix !== undefined
            ? entry.config.autofix
            : shouldFix && config.autofix;
        if (effectiveAutofix && rule.fix) {
          for (const issue of filtered) {
            if (issue.fixable) {
              try {
                rule.fix(issue);
              } catch (err) {
                console.error('Error applying fix:', err);
              }
            }
          }
        }
        return filtered;
      }
    } catch (e) {
      console.error(`Error running rule ${rule.id}:`, e);
    }
    return [];
  };

  // standalone rules
  for (const item of standaloneRules) {
    runRule(item);
  }

  // flow rules(顺序执行,遇 issue 中断)
  for (const flowKey of Object.keys(flowRules)) {
    const items = flowRules[flowKey];
    items.sort(
      (a, b) => (a.rule.flow?.order ?? 0) - (b.rule.flow?.order ?? 0)
    );
    for (const item of items) {
      const issues = runRule(item);
      if (issues.length > 0) break;
    }
  }

  // 8. 报告(V3 老路径直接 report,V4 intent engine 路径走 handler 链)
  if (v4) {
    // V4 路径:把 issues 转 Rule.Found intent,handler 链消化,handler 负责最终输出
    await runV4Pipeline({
      resolvedRules,
      context,
      allIssues,
      reporter: config.reporter,
      autofix: shouldFix,
    });
  } else {
    // V3 老路径:直接 report
    report(allIssues, config.reporter);
  }
}

/**
 * V4 Intent Engine Pipeline
 *
 * 把 V3 已收集的 issues 转成 Rule.Found intent,
 * 走 dedupe → ignore → fix → escalate → report handler 链消化。
 *
 * 关键设计:
 * - 复用 V3 已跑的 rule.check()(避免双重扫描)
 * - emit 不立即 dispatch(避免无限递归),由 drain() 统一处理
 * - exit code 从 handler 链产出(不直接计算)
 */
async function runV4Pipeline(params: {
  resolvedRules: ResolvedRuleEntry[];
  context: import('@checkit/shared').RuleContext;
  allIssues: ReviewIssue[];
  reporter: 'stylish' | 'json' | 'silent';
  autofix: boolean;
}): Promise<void> {
  const { resolvedRules, context, allIssues, reporter, autofix } = params;

  // 动态 import V4 模块(避免循环依赖)
  const { IntentEngine, fingerprintOf } = await import('./intent/engine');
  const { runAdaptedRule } = await import('./intent/adapter');
  const { dedupeHandler, ignoreHandler, reportHandler } = await import(
    './intent/handlers/index'
  );

  // 1. 实例化 engine + 注册 handlers
  const engine = new IntentEngine({
    sync: true, // V4 同步模式,跑完 drain()
    options: { reporter, autofix },
  });
  engine.register('Rule.Found', dedupeHandler);
  engine.register('Rule.Found', ignoreHandler);
  engine.register('Rule.Report', reportHandler);

  // 2. 把 V3 已收集 issues 转成 Rule.Found intents
  // 用 issue.data.ruleId 找来源 rule(我们在 V3 跑 rule 时注入了)
  for (const issue of allIssues) {
    const ruleId = (issue.data as { ruleId?: string } | undefined)?.ruleId;
    if (!ruleId) {
      // 兜底:跳过没标 ruleId 的 issue(理论上不会有)
      continue;
    }
    engine.emit(
      'Rule.Found',
      { ruleId, issue },
      { fingerprint: fingerprintOf(ruleId, issue) }
    );
  }

  // 3. drain —— 处理所有 queued intents(走 handler 链)
  await engine.drain();

  // 4. emit Rule.Report —— 触发最终输出
  const reportId = engine.emit('Rule.Report', {
    issues: [],
    errors: 0,
    warnings: 0,
  });
  await engine.dispatch(reportId);

  // 5. exit code
  const exitCode = engine.getState().lastExitCode ?? 0;
  process.exit(exitCode);
}

/**
 * 报告 issues(支持 stylish / json / silent)
 */
function report(issues: ReviewIssue[], reporter: 'stylish' | 'json' | 'silent') {
  if (reporter === 'silent') {
    process.exit(issues.some((i) => i.level === 'error') ? 1 : 0);
  }

  if (reporter === 'json') {
    process.stdout.write(JSON.stringify(issues, null, 2) + '\n');
    process.exit(issues.some((i) => i.level === 'error') ? 1 : 0);
  }

  // stylish (default)
  if (issues.length === 0) {
    process.exit(0);
  }
  const out = issues
    .map(
      (issue) =>
        `[${issue.level.toUpperCase()}] ${issue.type} - ${issue.issue} (${issue.file || 'project'}${issue.line ? ':' + issue.line : ''})`
    )
    .join('\n');
  process.stdout.write(out + '\n');

  const hasErrors = issues.some((i) => i.level === 'error');
  process.exit(hasErrors ? 1 : 0);
}

/**
 * 扫描所有 .ts/.tsx/.js/.jsx 文件,提取 review-ignore 头部指令
 */
function buildReviewIgnoreMap(
  files: string[],
  targetPath: string
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!ext || !['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;
    const abs = path.join(targetPath, rel);
    if (!fs.existsSync(abs)) continue;
    let header = '';
    try {
      const content = fs.readFileSync(abs, 'utf-8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      header = content.split(eol).slice(0, 10).join('\n');
    } catch {
      continue;
    }
    const m = header.match(/review-ignore:\s*([^\n]+)/i);
    if (m) {
      const list = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length > 0) map[rel] = list;
    }
  }
  return map;
}

/**
 * 当 config 完全空(无 rules 且无 extends),fallback 到内置 normalParadigm
 * 保持向后兼容:无 config 也能跑
 */
async function loadFallbackRules(): Promise<ResolvedRuleEntry[]> {
  // 动态 import 避免循环依赖
  const { ruleClasses } = await import('./rules/registry');
  const { normalParadigm } = await import('./paradigms');

  const out: ResolvedRuleEntry[] = [];
  for (const [ruleId, cfg] of Object.entries(normalParadigm.rules)) {
    const RuleCtor = (ruleClasses as Record<string, new (options?: unknown) => ReviewRule>)[ruleId];
    if (!RuleCtor) continue;
    out.push({
      id: ruleId,
      RuleCtor,
      config: {
        level: cfg.issue ?? 'warn',
        options: cfg.options as Record<string, unknown> | undefined,
        autofix: cfg.autofix,
      },
    });
  }
  return out;
}
