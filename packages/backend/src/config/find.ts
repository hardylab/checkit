/**
 * 配置查找
 *
 * 类 ESLint:从 cwd 向上找配置文件。
 * 查找顺序(每一级目录内):
 *   1. <dir>/.checkit/{checkit|default}.config.{ext} — 私有目录优先
 *   2. <dir>/{checkit|default}.config.{ext}          — 项目根平铺
 * 直到 repo 边界(.git / package.json)
 */

import fs from 'fs';
import path from 'path';

const CONFIG_EXTENSIONS = ['.js', '.ts', '.json', '.yaml', '.yml'] as const;
// 配置名(按查找优先级排列)
const CONFIG_BASENAMES = ['checkit.config', 'default.config'] as const;
// 私有目录(优先查找)
const PRIVATE_DIRS = ['.checkit'] as const;

/**
 * 在单个目录下查找配置文件(优先 .checkit/ 子目录)
 */
function findInDir(dir: string): string | null {
  // 1. 优先 .checkit/ 子目录
  for (const privateDir of PRIVATE_DIRS) {
    const subDir = path.join(dir, privateDir);
    if (fs.existsSync(subDir) && fs.statSync(subDir).isDirectory()) {
      for (const basename of CONFIG_BASENAMES) {
        for (const ext of CONFIG_EXTENSIONS) {
          const candidate = path.join(subDir, `${basename}${ext}`);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }
  }
  // 2. 目录平铺
  for (const basename of CONFIG_BASENAMES) {
    for (const ext of CONFIG_EXTENSIONS) {
      const candidate = path.join(dir, `${basename}${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * 从 startDir 向上查找配置文件
 */
export function findConfigFile(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const found = findInDir(dir);
    if (found) return found;

    // 遇到 .git / package.json → repo 边界
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'package.json'))
    ) {
      // 本目录没有 config,停止向上
      return null;
    }

    dir = path.dirname(dir);
  }
  return null;
}

/**
 * 显式 --config 指定的文件
 *
 * 支持两种形式:
 * 1. 完整路径:`./my-config.json` / `/abs/path/config.yaml`
 * 2. 短名(无扩展名):`strict` → 在 cwd 找 .checkit/strict.config.{json,yaml,js,ts}
 *    或 ./strict.config.{json,yaml,js,ts} 或 ./strict.{json,yaml,js,ts}
 */
export function resolveExplicitConfig(configPath: string, cwd: string): string | null {
  // 短名模式:无扩展名,自动找
  if (!path.extname(configPath)) {
    const baseName = path.basename(configPath);
    const candidates: string[] = [];

    // 1. cwd/.checkit/<baseName>.config.{ext}
    for (const ext of CONFIG_EXTENSIONS) {
      candidates.push(path.join(cwd, '.checkit', `${baseName}.config${ext}`));
    }
    // 2. cwd/<baseName>.config.{ext}
    for (const ext of CONFIG_EXTENSIONS) {
      candidates.push(path.join(cwd, `${baseName}.config${ext}`));
    }
    // 3. cwd/<baseName>.{ext} (短名)
    for (const ext of CONFIG_EXTENSIONS) {
      candidates.push(path.join(cwd, `${baseName}${ext}`));
    }

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    throw new Error(
      `Config '${configPath}' not found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
    );
  }

  // 完整路径模式
  const resolved = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(cwd, configPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  return resolved;
}
