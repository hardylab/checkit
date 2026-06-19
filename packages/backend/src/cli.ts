#!/usr/bin/env tsx
/**
 * CheckIt CLI
 *
 * V4-only 架构(intent engine 是唯一执行方式)
 *
 * 流程:
 * 1. 解析 argv(--config / --rule / --ignore / --fix / --recent / --json / --reporter)
 * 2. 加载 checkit.config.*(从 cwd 向上找 / 或 --config 短名)
 * 3. 解析 extends(preset + 相对路径)
 * 4. 加载 .checkitignore
 * 5. glob 收集文件 → 应用 ignore
 * 6. 实例化 IntentEngine
 * 7. 注册 handlers(dedupe / ignore / fix / escalate / report)
 * 8. 通过 runAdaptedRule 走 adapter,V3 rule 自动包成 V4 form
 * 9. emit Rule.Found intents
 * 10. drain —— handler 链消化
 * 11. emit Rule.Report 触发最终输出
 * 12. exit code = engine.getState().lastExitCode
 *
 * V3 时代(直接 allIssues[] + report)已彻底删除,所有 rule 走 V4 intent engine。
 */

import path from 'path';
import { glob } from 'glob';
import type { RuleContext } from '@checkit/shared';

import { loadFullConfig, type ResolvedRuleEntry } from './config';

export interface CLIOptions {
  cwd?: string;
  targetPath?: string;
  shouldFix?: boolean;
  recentMinutes?: number | undefined;
  configPath?: string | null;
  cliRules?: Record<string, 'off' | 'warn' | 'error'>;
  cliIgnorePatterns?: string[];
  argv?: string[];
  reporter?: 'stylish' | 'json' | 'silent';
  /** 保留以兼容老调用(忽略,V4 永远启用) */
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
  reporter: 'stylish' | 'json' | 'silent';
} {
  const shouldFix = args.includes('--fix');

  // --reporter stylish|json|silent
  let reporter: 'stylish' | 'json' | 'silent' = 'stylish';
  const reporterIdx = args.indexOf('--reporter');
  if (reporterIdx !== -1) {
    const val = args[reporterIdx + 1];
    if (val === 'stylish' || val === 'json' || val === 'silent') {
      reporter = val;
    }
  }
  // --json 是 --reporter json 的简写
  if (args.includes('--json')) reporter = 'json';

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

  // --config <path|short-name>
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

  return { targetPath, shouldFix, recentMinutes, configPath, cliRules, cliIgnorePatterns, reporter };
}

export async function runCLI(options?: CLIOptions) {
  const cwd = options?.cwd ?? process.cwd();
  const args = options?.argv ?? process.argv.slice(2);

  // 1. parseArgs
  let targetPathArg: string;
  let shouldFix: boolean;
  let recentMinutes: number | undefined;
  let configPath: string | null;
  let cliRules: Record<string, 'off' | 'warn' | 'error'>;
  let cliIgnorePatterns: string[];
  let reporter: 'stylish' | 'json' | 'silent';

  if (options?.argv || options?.targetPath !== undefined || options?.shouldFix !== undefined) {
    const parsed = parseArgs(options?.argv ?? args);
    targetPathArg = options?.targetPath ?? parsed.targetPath;
    shouldFix = options?.shouldFix ?? parsed.shouldFix;
    recentMinutes = options?.recentMinutes ?? parsed.recentMinutes;
    configPath = options?.configPath ?? parsed.configPath;
    cliRules = options?.cliRules ?? parsed.cliRules;
    cliIgnorePatterns = options?.cliIgnorePatterns ?? parsed.cliIgnorePatterns;
    reporter = options?.reporter ?? parsed.reporter;
  } else {
    targetPathArg = options?.targetPath ?? '.';
    shouldFix = options?.shouldFix ?? false;
    recentMinutes = options?.recentMinutes;
    configPath = options?.configPath ?? null;
    cliRules = options?.cliRules ?? {};
    cliIgnorePatterns = options?.cliIgnorePatterns ?? [];
    reporter = options?.reporter ?? 'stylish';
  }

  const targetPath = path.resolve(cwd, targetPathArg);
  const targetName = path.basename(targetPath);

  // 2a. 处理 --config 短名
  let resolvedConfigPath: string | null = null;
  if (configPath) {
    const { resolveExplicitConfig } = await import('./config/find');
    resolvedConfigPath = resolveExplicitConfig(configPath, cwd);
  }

  // 2b. 加载完整 config
  const { config, ignore } = await loadFullConfig(cwd, {
    configPath: resolvedConfigPath,
    cliRules,
    cliIgnorePatterns,
  });

  // 3. fallback 到 normalParadigm
  let resolvedRules: ResolvedRuleEntry[] = config.rules;
  if (resolvedRules.length === 0) {
    resolvedRules = await loadFallbackRules();
  }

  // 4. glob 收集文件
  let files = await glob('**/*', {
    cwd: targetPath,
    nodir: true,
  });
  files = files.filter((f) => {
    if (f.includes('node_modules/') || f.includes('.git/') || f.includes('dist/')) {
      return false;
    }
    return !ignore.matches(f);
  });

  // --recent
  if (recentMinutes !== undefined) {
    const cutoff = Date.now() - recentMinutes * 60 * 1000;
    files = files.filter((f) => {
      const abs = path.join(targetPath, f);
      try {
        const s = require('fs').statSync(abs);
        return s.mtimeMs >= cutoff || s.birthtimeMs >= cutoff;
      } catch {
        return false;
      }
    });
  }

  const context: RuleContext = {
    cwd,
    projectRoot: cwd,
    targetPath,
    targetName,
    targetType: 'project',
    files,
    autoFix: shouldFix,
  };

  // 5. V4 Intent Engine Pipeline
  // V3 时代预扫 + report 已彻底删除
  // 所有 rule 走 adapter → V4 intent 链
  await runV4Pipeline({
    resolvedRules,
    context,
    reporter,
    autofix: shouldFix,
  });
}

/**
 * V4 Intent Engine Pipeline(唯一执行方式)
 *
 * 流程:
 * 1. 实例化 IntentEngine
 * 2. 注册 handlers(dedupe / ignore / report)
 * 3. 对每个 rule 调 runAdaptedRule —— V3 rule 自动包成 V4
 * 4. emit Rule.Found intents
 * 5. drain —— handler 链消化
 * 6. emit Rule.Report 触发最终输出
 * 7. exit code = engine.getState().lastExitCode
 */
async function runV4Pipeline(params: {
  resolvedRules: ResolvedRuleEntry[];
  context: RuleContext;
  reporter: 'stylish' | 'json' | 'silent';
  autofix: boolean;
}): Promise<void> {
  const { resolvedRules, context, reporter, autofix } = params;

  // 动态 import V4 模块
  const { IntentEngine, fingerprintOf } = await import('./intent/engine');
  const { runAdaptedRule } = await import('./intent/adapter');
  const { dedupeHandler, ignoreHandler, reportHandler } = await import(
    './intent/handlers/index'
  );
  const { ruleClasses } = await import('./rules/registry');

  // 1. 实例化 engine + 注册 handlers
  const engine = new IntentEngine({
    sync: true,
    options: { reporter, autofix },
  });
  engine.register('Rule.Found', dedupeHandler);
  engine.register('Rule.Found', ignoreHandler);
  engine.register('Rule.Report', reportHandler);

  // 2. 对每个 rule 调 runAdaptedRule
  //    V3 rule 通过 adapter 自动 emit Rule.Found intents
  const emitFn = <P>(type: string, payload: P) => engine.emit(type, payload);

  for (const entry of resolvedRules) {
    let Ctor: (new (options?: unknown) => any) | null = null;

    // a) 内置规则(从 ruleClasses 查)
    if (entry.id in ruleClasses) {
      Ctor = (ruleClasses as Record<string, new (options?: unknown) => any>)[entry.id];
    }
    // b) 项目本地规则(.ts / .js 路径)
    else if (entry.id.endsWith('.ts') || entry.id.endsWith('.js')) {
      try {
        const path = await import('path');
        const fs = await import('fs');
        const url = await import('url');
        const resolved = path.isAbsolute(entry.id)
          ? entry.id
          : path.resolve(context.cwd, entry.id);
        if (fs.existsSync(resolved)) {
          const mod = await import(url.pathToFileURL(resolved).href);
          Ctor = mod.default ?? mod[entry.id] ?? null;
        }
      } catch (e) {
        console.error(`Failed to load custom rule ${entry.id}:`, e);
      }
    }

    if (!Ctor) continue;

    try {
      const v3 = new Ctor(entry.config.options);
      const adapted = {
        id: entry.id,
        v3,
        scan: (ctx: RuleContext) => runAdaptedRule(adapted, ctx, emitFn),
        fix: (intent: any) => {
          if (typeof v3.fix === 'function') return v3.fix(intent.payload.issue);
          return false;
        },
      };
      runAdaptedRule(adapted, context, emitFn);
    } catch (e) {
      console.error(`Failed to run rule ${entry.id}:`, e);
    }
  }

  // 3. drain —— 处理所有 queued intents
  await engine.drain();

  // 4. emit Rule.Report
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
 * 当 config 完全空(无 rules 且无 extends),fallback 到内置 normalParadigm
 * 保持向后兼容:无 config 也能跑
 */
async function loadFallbackRules(): Promise<ResolvedRuleEntry[]> {
  const { ruleClasses } = await import('./rules/registry');
  const { normalParadigm } = await import('./paradigms');

  const out: ResolvedRuleEntry[] = [];
  for (const [ruleId, cfg] of Object.entries(normalParadigm.rules)) {
    const RuleCtor = (ruleClasses as Record<string, new (options?: unknown) => any>)[ruleId];
    if (!RuleCtor) continue;
    out.push({
      id: ruleId,
      RuleCtor,
      config: {
        level: (cfg.issue ?? 'warn') as 'off' | 'warn' | 'error',
        type: undefined,
        options: cfg.options as Record<string, unknown> | undefined,
        autofix: cfg.autofix,
      },
    });
  }
  return out;
}
