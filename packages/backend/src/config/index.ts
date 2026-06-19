/**
 * 配置模块统一导出
 */

export type {
  CheckitConfig,
  ResolvedConfig,
  ResolvedRuleEntry,
  RuleConfig,
} from './types';

export { DEFAULT_CONFIG } from './types';

export {
  findConfigFile,
  resolveExplicitConfig,
} from './find';

export {
  loadConfigFile,
  parseSimpleYaml,
} from './load';

export {
  resolveExtends,
  resolveExtendsEntry,
  mergeConfigs,
} from './extends';

import fs from 'fs';
import path from 'path';
import type { CheckitConfig, ResolvedConfig, ResolvedRuleEntry } from './types';
import { DEFAULT_CONFIG } from './types';
import { findConfigFile } from './find';
import { loadConfigFile } from './load';
import { resolveExtends } from './extends';
import { ruleClasses } from '../rules/registry';
import { CheckitIgnore } from '../ignore';

/**
 * 加载 + 解析 + merge 完整配置
 *
 * 流程:
 * 1. 找 config 文件(若指定 --config 则用指定的)
 * 2. 加载 + 解析 extends
 * 3. 应用 DEFAULT_CONFIG 作为兜底
 * 4. 加载 .checkitignore 文件
 * 5. 解析 RuleConfig 简写到完整形式
 * 6. 解析自定义规则路径(支持 .ts 动态 import)
 */
export async function loadFullConfig(
  cwd: string,
  options: {
    configPath?: string | null;
    cliIgnorePatterns?: string[];
    cliRules?: Record<string, 'off' | 'warn' | 'error'>;
  } = {}
): Promise<{ config: ResolvedConfig; ignore: CheckitIgnore }> {
  // 1. 找 config
  const configFile = options.configPath ?? findConfigFile(cwd);
  let rawConfig: CheckitConfig = {};

  if (configFile) {
    rawConfig = await loadConfigFile(configFile);
  }

  // 2. 解析 extends(需要 cwd)
  const configWithExtends = await resolveExtends(rawConfig, cwd);

  // 3. 应用 DEFAULT_CONFIG 兜底
  let merged: CheckitConfig = {
    ...DEFAULT_CONFIG,
    ...configWithExtends,
    rules: {
      ...(DEFAULT_CONFIG.rules ?? {}),
      ...(configWithExtends.rules ?? {}),
      // 4. CLI --rule 优先级最高
      ...(options.cliRules ?? {}),
    },
    ignorePatterns: [
      ...(DEFAULT_CONFIG.ignorePatterns ?? []),
      ...(configWithExtends.ignorePatterns ?? []),
      ...(options.cliIgnorePatterns ?? []),
    ],
  };

  // 5. 加载 .checkitignore
  let ignore = CheckitIgnore.load(cwd);
  if (options.cliIgnorePatterns && options.cliIgnorePatterns.length > 0) {
    ignore = ignore.withPatterns(options.cliIgnorePatterns);
  }

  // 6. 解析 RuleConfig 简写到完整形式 + 找 RuleCtor
  const resolvedRules = await resolveRuleEntries(merged.rules ?? {}, cwd);

  return {
    config: {
      rules: resolvedRules,
      ignorePatterns: merged.ignorePatterns ?? [],
      target: merged.target ?? '.',
      autofix: merged.autofix ?? false,
      reporter: merged.reporter ?? 'stylish',
    },
    ignore,
  };
}

/**
 * 把 rules 配置 + 内置 ruleClasses 合并,得到 ResolvedRuleEntry[]
 *
 * 逻辑:
 * - 内置规则(ruleClasses 有):直接用
 * - 自定义规则(.ts 路径):动态 import
 * - "off":跳过
 */
async function resolveRuleEntries(
  rulesConfig: Record<string, import('./types').RuleConfig>,
  cwd: string
): Promise<ResolvedRuleEntry[]> {
  const out: ResolvedRuleEntry[] = [];

  for (const [ruleId, ruleConfig] of Object.entries(rulesConfig)) {
    const normalized = normalizeRuleConfig(ruleConfig);
    if (normalized.level === 'off') continue;

    // 内置规则
    if (ruleId in ruleClasses) {
      const RuleCtor = (ruleClasses as Record<string, new (options?: unknown) => import('@checkit/shared').ReviewRule>)[ruleId];
      out.push({
        id: ruleId,
        RuleCtor,
        config: normalized,
      });
      continue;
    }

    // 自定义规则路径(.ts / .js)
    if (ruleId.endsWith('.ts') || ruleId.endsWith('.js')) {
      const resolved = path.isAbsolute(ruleId)
        ? ruleId
        : path.resolve(cwd, ruleId);
      if (!fs.existsSync(resolved)) {
        console.warn(`Custom rule file not found: ${resolved}`);
        continue;
      }
      const mod = await import(pathToFileUrl(resolved));
      const RuleCtor = mod.default ?? mod.RuleCtor ?? mod[ruleId];
      if (!RuleCtor) {
        console.warn(`Custom rule ${ruleId} has no default export`);
        continue;
      }
      out.push({
        id: ruleId,
        RuleCtor,
        config: normalized,
      });
      continue;
    }

    // 未知规则:warn
    console.warn(`Unknown rule: ${ruleId} (not in built-in registry and not a file path)`);
  }

  return out;
}

function normalizeRuleConfig(
  cfg: import('./types').RuleConfig
): ResolvedRuleEntry['config'] {
  if (typeof cfg === 'string') {
    return { level: cfg };
  }
  return {
    level: cfg.level ?? 'warn',
    type: cfg.type,
    options: cfg.options,
    autofix: cfg.autofix,
  };
}

function pathToFileUrl(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    return 'file://' + normalized;
  }
  return 'file:///' + normalized;
}
