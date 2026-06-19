/**
 * .checkitignore 解析器
 *
 * 类似 .eslintignore / .gitignore,基于 minimatch glob 模式匹配。
 * - 空行 / # 开头的行 = 忽略
 * - 以 ! 开头 = 反向豁免(强制包含)— 当前实现先省略(避免和 ESLint 行为偏差)
 * - 以 / 开头 = 相对根
 * - 不以 / 开头 = 匹配任意目录层级
 * - 以 / 结尾 = 仅匹配目录
 */

import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

export class CheckitIgnore {
  private patterns: Array<{ pattern: string; isDir: boolean }> = [];

  constructor(patterns: string[] = []) {
    this.patterns = patterns
      .map((raw) => {
        const line = raw.replace(/\\\s*$/, '').trim();
        if (!line || line.startsWith('#')) return null;
        if (line.startsWith('!')) return null; // 暂不支持反向
        const isDir = line.endsWith('/');
        return { pattern: isDir ? line + '**' : line, isDir };
      })
      .filter((p): p is { pattern: string; isDir: boolean } => p !== null);
  }

  /**
   * 判断给定相对路径(相对 cwd)是否被豁免
   */
  matches(relPath: string): boolean {
    const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');

    for (const { pattern } of this.patterns) {
      // 直接用 minimatch match(支持 ** 通配)
      if (minimatch(normalized, pattern, { dot: true })) {
        return true;
      }
    }
    return false;
  }

  /**
   * 过滤文件列表
   */
  filter(files: string[]): string[] {
    return files.filter((f) => !this.matches(f));
  }

  /**
   * 从文件加载 .checkitignore(从 cwd 向上找,类似 ESLint)
   */
  static load(cwd: string): CheckitIgnore {
    const ignorePath = findIgnoreFile(cwd);
    if (!ignorePath) return new CheckitIgnore([]);
    const content = fs.readFileSync(ignorePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    return new CheckitIgnore(lines);
  }

  /**
   * 合并命令行 --ignore-pattern
   */
  withPatterns(extra: string[]): CheckitIgnore {
    const existing = this.patterns.map((p) => p.pattern);
    return new CheckitIgnore([...existing, ...extra]);
  }
}

/**
 * 从 startDir 向上找 .checkitignore,直到根目录或 repo 边界
 */
export function findIgnoreFile(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, '.checkitignore');
    if (fs.existsSync(candidate)) return candidate;

    // 边界:遇到 .git / package.json 视为 repo 边界
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'package.json'))
    ) {
      return null;
    }

    dir = path.dirname(dir);
  }
  return null;
}
