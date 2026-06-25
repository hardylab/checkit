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
import { PRESET_COMMANDS, type PresetCommandName } from './preset';
import { CONFIG_COMMANDS, type ConfigCommandName } from './config/commands';
import { cmdChat } from './chat';
import { cmdDoctor } from './doctor';
import { runUpload } from './scan/upload';

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
  /**
   * 开发模式 —— checkit 自检自己
   *
   * 行为:
   * - targetPath 自动覆盖到 `<monorepo-root>/packages/backend/src`
   * - 用 devParadigm(rule-self-check + rule-structure + okf-compliance)替换 normalParadigm
   * - 输出 banner 表明进入 dev 模式
   * - 错误时 exit 1(强制阻塞)
   *
   * 用途:`pnpm test` 跑完后,checkit 自己也必须通过自己的 meta-rule。
   * 不是用来跑用户项目的。
   */
  dev?: boolean;
  /**
   * AI-Fix 模式 —— 调 AI 自动修 issue
   *
   * 行为:
   * - 跑完一轮 check 后,把所有 issue 收集
   * - 选一个可用 AI agent(claude / opencode / hermes / openclaw)
   * - 对每个 issue 调 AI 修(写文件)
   * - 输出修复汇总
   *
   * 默认自动选第一个可用 agent。`aiAgent` 强制指定。
   */
  aiFix?: boolean;
  /** 显式指定 AI agent: 'claude' | 'opencode' | 'hermes' | 'openclaw' */
  aiAgent?: string;
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
  dev: boolean;
  aiFix: boolean;
  aiAgent: string | undefined;
} {
  const shouldFix = args.includes('--fix');
  const dev = args.includes('--dev');
  const aiFix = args.includes('--ai-fix');

  // --ai-agent <name>
  const aiAgentIdx = args.indexOf('--ai-agent');
  let aiAgent: string | undefined;
  if (aiAgentIdx !== -1) {
    const val = args[aiAgentIdx + 1];
    if (val && !val.startsWith('--')) {
      aiAgent = val;
    }
  }

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
  // --dev 模式忽略位置参数(target 自动覆盖)
  // 关键:必须跳过 --reporter / --ai-agent / --config / --recent 等 flag 的 value
  // (这些 value 也不以 -- 开头,会被误当成 targetPath)
  const skipNext = new Set<number>();
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === '--reporter' || args[i] === '--ai-agent' || args[i] === '--config' || args[i] === '--recent') {
      skipNext.add(i + 1);
    }
  }
  const targetPath = dev
    ? '.'
    : args.find(
        (arg, i) =>
          !arg.startsWith('--') &&
          !skipNext.has(i) &&
          !(!isNaN(Number(arg)) && args[i - 1] === '--recent')
      ) || '.';

  return {
    targetPath,
    shouldFix,
    recentMinutes,
    configPath,
    cliRules,
    cliIgnorePatterns,
    reporter,
    dev,
    aiFix,
    aiAgent,
  };
}

export async function runCLI(options?: CLIOptions) {
  const cwd = options?.cwd ?? process.cwd();
  const args = options?.argv ?? process.argv.slice(2);

  // ─── 0. subcommand dispatch ─────────────────────────────────
  // 第一 arg 如果是 preset / config / chat / doctor namespace,
  // 转交对应模块。任何其它第一 arg(包括 cwd 路径)走老 scan 路径。
  // 例:`lintany preset list` / `lintany config set theme dark` /
  //    `lintany chat "TS strict"` / `lintany doctor`
  const firstNonFlag = args.find((a) => !a.startsWith('--'));
  const KNOWN_NAMESPACES: Record<string, Record<string, (args: string[], cwd: string) => void | Promise<void>> | null> = {
    preset: PRESET_COMMANDS as unknown as Record<string, (args: string[], cwd: string) => void | Promise<void>>,
    config: CONFIG_COMMANDS as unknown as Record<string, (args: string[], cwd: string) => void | Promise<void>>,
    chat: null, // async, special-cased below
    doctor: { '': (a, cwd) => cmdDoctor(a, cwd) } as unknown as Record<string, (args: string[], cwd: string) => void | Promise<void>>, // doctor has no subcommand
  };

  if (firstNonFlag && Object.prototype.hasOwnProperty.call(KNOWN_NAMESPACES, firstNonFlag)) {
    const ns = firstNonFlag as 'preset' | 'config' | 'chat' | 'doctor';

    if (ns === 'chat') {
      // chat 是 async,且接受 positional message(无 sub)
      try {
        await cmdChat(args.slice(args.indexOf('chat') + 1), cwd);
        return;
      } catch (e) {
        console.error(`error: ${(e as Error).message}`);
        process.exit(1);
      }
    }

    if (ns === 'doctor') {
      try {
        cmdDoctor(args.slice(args.indexOf('doctor') + 1), cwd);
        return;
      } catch (e) {
        console.error(`error: ${(e as Error).message}`);
        process.exit(1);
      }
    }

    const registry = KNOWN_NAMESPACES[ns]!;
    const sub = args[args.indexOf(ns) + 1];
    if (!sub) {
      console.error(`error: '${ns}' requires a subcommand.`);
      console.error(`       known: ${Object.keys(registry).join(', ')}`);
      process.exit(1);
    }
    const fn = registry[sub];
    if (!fn) {
      console.error(`error: unknown ${ns} subcommand "${sub}".`);
      console.error(`       known: ${Object.keys(registry).join(', ')}`);
      process.exit(1);
    }
    const rest = args.slice(args.indexOf(sub) + 1);
    try {
      const result = fn(rest, cwd);
      if (result instanceof Promise) await result;
      return;
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  // ─── 0b. scan --upload <file> — short-circuit before parseArgs ─────
  // --upload 跳过 file scan,直接读 JSON 当 issues 输出。
  const uploadIdx = args.indexOf('--upload');
  if (uploadIdx !== -1) {
    const uploadFile = args[uploadIdx + 1];
    if (!uploadFile || uploadFile.startsWith('--')) {
      console.error('error: --upload <file> required');
      process.exit(1);
    }
    const reporter = args.includes('--json')
      ? 'json'
      : args.includes('--reporter') && args[args.indexOf('--reporter') + 1] === 'silent'
        ? 'silent'
        : 'stylish';
    const exitOnError = args.includes('--exit-on-error');
    const code = runUpload({ file: uploadFile, reporter, exitOnError });
    process.exit(code);
  }

  // 1. parseArgs —— always parse argv, even when options is passed.
  //    The previous guard `if (options?.argv || ...)` accidentally skipped
  //    parsing in `runCLI()` (no-options) calls, which made --dev / --fix /
  //    --reporter silently inert. Merge options on top of parsed.
  const parsed = parseArgs(args);

  let targetPathArg: string;
  let shouldFix: boolean;
  let recentMinutes: number | undefined;
  let configPath: string | null;
  let cliRules: Record<string, 'off' | 'warn' | 'error'>;
  let cliIgnorePatterns: string[];
  let reporter: 'stylish' | 'json' | 'silent';
  let dev: boolean;
  let aiFix: boolean;
  let aiAgent: string | undefined;

  targetPathArg = options?.targetPath ?? parsed.targetPath;
  shouldFix = options?.shouldFix ?? parsed.shouldFix;
  recentMinutes = options?.recentMinutes ?? parsed.recentMinutes;
  configPath = options?.configPath ?? parsed.configPath;
  cliRules = options?.cliRules ?? parsed.cliRules;
  cliIgnorePatterns = options?.cliIgnorePatterns ?? parsed.cliIgnorePatterns;
  reporter = options?.reporter ?? parsed.reporter;
  dev = options?.dev ?? parsed.dev;
  aiFix = parsed.aiFix;
  aiAgent = options?.aiAgent ?? parsed.aiAgent;

  // ─── DEV 模式短路 ────────────────────────────────────────
  // dev 模式优先于 config/argv 的常规解析:
  // - target 强制 = <monorepo-root>/packages/backend/src
  // - paradigm 强制 = devParadigm
  // - 输出 banner
  let resolvedRules: ResolvedRuleEntry[] = [];
  let ignore: { matches: (f: string) => boolean };

  if (dev) {
    const { findRepoRoot, resolveDevTarget } = await import('./cli-utils');
    const repoRoot = findRepoRoot(cwd);
    const devTarget = resolveDevTarget(repoRoot);

    process.stdout.write(`\n🔧 checkit dev mode: self-checking ${devTarget}\n`);
    process.stdout.write(`   repoRoot = ${repoRoot}\n`);
    process.stdout.write(`   rules    = rule-self-check (error), rule-structure (error), okf-compliance (warn)\n\n`);

    targetPathArg = devTarget;
    configPath = null;
    cliRules = {};
    cliIgnorePatterns = [];

    // 显式加载 devParadigm
    const { ruleClasses } = await import('./rules/registry');
    const { devParadigm } = await import('./paradigms');
    for (const [ruleId, cfg] of Object.entries(devParadigm.rules)) {
      const RuleCtor = (ruleClasses as Record<string, new (options?: unknown) => any>)[ruleId];
      if (!RuleCtor) continue;
      resolvedRules.push({
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
    ignore = { matches: () => false };
  } else {
    // 2a. 处理 --config 短名
    let resolvedConfigPath: string | null = null;
    if (configPath) {
      const { resolveExplicitConfig } = await import('./config/find');
      resolvedConfigPath = resolveExplicitConfig(configPath, cwd);
    }

    // 2b. 加载完整 config
    const cfg = await loadFullConfig(cwd, {
      configPath: resolvedConfigPath,
      cliRules,
      cliIgnorePatterns,
    });
    resolvedRules = cfg.config.rules;
    ignore = cfg.ignore;

    // 3. fallback 到 normalParadigm
    if (resolvedRules.length === 0) {
      resolvedRules = await loadFallbackRules();
    }
  }

  const targetPath = path.resolve(cwd, targetPathArg);
  const targetName = path.basename(targetPath);

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
    dev,
    aiFix,
    aiAgent,
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
  dev?: boolean;
  aiFix?: boolean;
  aiAgent?: string;
}): Promise<void> {
  const { resolvedRules, context, reporter, autofix, dev, aiFix: aiFixEnabled, aiAgent } = params;

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
    options: { reporter, autofix, dev },
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

  // 5. AI-Fix hook —— if --ai-fix, pick an agent and try to fix each issue
  if (aiFixEnabled) {
    const activeIssues = Array.from(engine.getState().activeIssues.values());
    if (activeIssues.length === 0) {
      process.stdout.write('✅ no issues — nothing for AI-Fix to do\n');
    } else {
      process.stdout.write(`\n🤖 AI-Fix: ${activeIssues.length} issue(s) to fix\n`);
      try {
        const { aiFix } = await import('./ai');
        const result = await aiFix(activeIssues, {
          cwd: context.cwd,
          targetPath: context.targetPath,
          files: context.files,
        }, {
          agentName: aiAgent,
          verify: false, // verify pass would re-run all rules; leave as a future knob
        });
        process.stdout.write(`   agent:   ${result.agentUsed ?? '(none available)'}\n`);
        process.stdout.write(`   fixed:   ${result.fixedCount}/${result.totalIssues}\n`);
        process.stdout.write(`   failed:  ${result.failedCount}\n`);
        process.stdout.write(`   skipped: ${result.skippedCount}\n`);
        if (result.fixedCount > 0) {
          process.stdout.write(`\n✨ Re-run \`checkit\` to verify the fixes.\n`);
        }
      } catch (e) {
        process.stderr.write(`AI-Fix error: ${(e as Error).message}\n`);
      }
    }
  }

  // 6. exit code
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
