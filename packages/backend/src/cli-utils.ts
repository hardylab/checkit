// spec:[spec](specs/backend/cli-utils.md)
import fs from 'fs';
import path from 'path';

/**
 * 找 monorepo 根目录
 *
 * 启发式:从 startDir 向上找,直到遇到 `.git` 或顶层 `package.json`(带 `workspaces` 字段)。
 * - 普通 repo:`<repo>/.git` 存在即停
 * - monorepo:`<repo>/package.json` 含 `pnpm.workspaces` 或 `workspaces` 字段
 *
 * 兜底:始终返回 startDir(让 dev 模式跑当前目录也行)。
 *
 * 关键:必须正确处理 Windows + Git Bash / WSL 路径(`/` 与 `\` 都行)。
 */
export function findRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    // 1. 命中 .git
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }

    // 2. 顶层 package.json + workspaces 字段
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
        if (pkg.workspaces || pkg.pnpm?.workspaces) {
          return dir;
        }
      } catch {
        // 解析失败,继续向上
      }
    }

    dir = path.dirname(dir);
  }
  // 兜底:返回 startDir
  return path.resolve(startDir);
}

/**
 * dev 模式的扫描目标
 *
 * 固定 = `<repoRoot>/packages/backend/src`
 * (只扫 backend src,避免误触发 frontend / docs 的规则)
 *
 * 不存在时抛错(用户不该在非 checkit monorepo 跑 --dev)。
 */
export function resolveDevTarget(repoRoot: string): string {
  const target = path.join(repoRoot, 'packages', 'backend', 'src');
  if (!fs.existsSync(target)) {
    throw new Error(
      `dev mode target not found: ${target}\n` +
        `checkit --dev must run inside the checkit monorepo.\n` +
        `If you're hacking checkit locally, cd into the checkit repo root and try again.`
    );
  }
  return target;
}