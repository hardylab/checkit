/**
 * extends / preset 加载器
 *
 * 解析顺序:
 * 1. 当前 config.extends 数组
 * 2. 每个 entry 可以是:
 *    - 包名:"@checkit/preset-normal" → 从 node_modules/@checkit/preset-normal/load 找
 *    - 相对路径:"./.checkit/presets/my.yaml" → 从 cwd 找
 * 3. 多个 preset 按顺序 merge(后者覆盖前者)
 */

import fs from 'fs';
import path from 'path';
import type { CheckitConfig } from './types';
import { loadConfigFile } from './load';

/**
 * 解析单个 extends entry,返回该 preset 的 CheckitConfig
 */
export async function resolveExtendsEntry(
  entry: string,
  cwd: string
): Promise<CheckitConfig> {
  // 1. 相对路径:从 cwd 或 .checkit/presets/ 找
  if (entry.startsWith('.') || entry.startsWith('/')) {
    const resolved = path.isAbsolute(entry)
      ? entry
      : path.resolve(cwd, entry);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Extends entry not found: ${resolved}`);
    }
    return await loadConfigFile(resolved);
  }

  // 2. 包名:从 node_modules 找
  // 优先尝试 <package>/checkit.preset.{json,yaml,js,ts}
  // 兜底:<package>/dist/index.js (导出 default)
  const pkgRoot = resolvePackagePath(entry, cwd);
  if (!pkgRoot) {
    throw new Error(`Cannot resolve package: ${entry}`);
  }

  // 优先:显式 preset 文件
  const candidates = [
    path.join(pkgRoot, 'checkit.preset.json'),
    path.join(pkgRoot, 'checkit.preset.yaml'),
    path.join(pkgRoot, 'checkit.preset.yml'),
    path.join(pkgRoot, 'checkit.preset.js'),
    path.join(pkgRoot, 'checkit.preset.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return await loadConfigFile(c);
    }
  }

  // 兜底:尝试 import package 并取 default
  try {
    const mod = await import(entry);
    const cfg = mod.default ?? mod.preset ?? mod.config;
    if (!cfg) {
      throw new Error(`Package ${entry} has no default export`);
    }
    return cfg as CheckitConfig;
  } catch (e) {
    throw new Error(
      `Cannot load preset from ${entry}: no checkit.preset.* found and default export missing (${(e as Error).message})`
    );
  }
}

/**
 * 解析 extends 链,返回合并后的 CheckitConfig
 *
 * 合并规则(类 ESLint):
 * - extends 按顺序叠加,后者覆盖前者
 * - rules 对象 deep merge
 * - 数组字段(ignorePatterns / extends)拼接
 */
export async function resolveExtends(
  config: CheckitConfig,
  cwd: string,
  visited: Set<string> = new Set()
): Promise<CheckitConfig> {
  if (!config.extends || config.extends.length === 0) {
    return config;
  }

  let merged: CheckitConfig = {};

  for (const entry of config.extends) {
    if (visited.has(entry)) {
      throw new Error(`Circular extends detected: ${entry}`);
    }
    visited.add(entry);

    const presetConfig = await resolveExtendsEntry(entry, cwd);
    // 递归:preset 自己可能也有 extends
    const resolvedPreset = await resolveExtends(presetConfig, cwd, visited);

    merged = mergeConfigs(merged, resolvedPreset);
  }

  // 用户 config 优先级最高(覆盖 preset)
  return mergeConfigs(merged, config);
}

/**
 * Deep merge 两个 CheckIt 配置
 */
export function mergeConfigs(
  base: CheckitConfig,
  override: CheckitConfig
): CheckitConfig {
  return {
    extends: [...(base.extends ?? []), ...(override.extends ?? [])],
    rules: {
      ...(base.rules ?? {}),
      ...(override.rules ?? {}),
    },
    ignorePatterns: [
      ...(base.ignorePatterns ?? []),
      ...(override.ignorePatterns ?? []),
    ],
    target: override.target ?? base.target,
    autofix: override.autofix ?? base.autofix,
    reporter: override.reporter ?? base.reporter,
  };
}

/**
 * 从 cwd 向上找 node_modules/<pkg>
 * 类似 Node 解析,但简化
 */
function resolvePackagePath(pkgName: string, cwd: string): string | null {
  let dir = path.resolve(cwd);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, 'node_modules', pkgName, 'package.json');
    if (fs.existsSync(candidate)) {
      return path.dirname(candidate);
    }
    dir = path.dirname(dir);
  }
  return null;
}
