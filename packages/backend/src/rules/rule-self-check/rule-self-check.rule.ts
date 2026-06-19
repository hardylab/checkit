// spec:[spec](specs/backend/rules/rule-self-check.md)
import fs from 'fs';
import type { ReviewIssue, RuleContext } from '@checkit/shared';
import { windowSafeJoin } from '../_shared/utils';

/**
 * Rule self-check 规则
 *
 * 检查每个 rule 文件夹**至少包含**:
 * - <name>.rule.ts(rule 实现)
 * - README.md(规则说明,给规则商城用)
 *
 * 这是 checkit 自身的元规则(meta-rule)。
 * 用于自举(self-bootstrapping)时,确保每个内置规则都有完整文档。
 *
 * glob: 任意层 *.rule.ts(命中每个 rule 文件)
 * 触发:该 rule 所在文件夹缺 README.md
 *
 * 设计:warn 级别(可以临时缺,提醒而不是阻塞)
 */

const RuleSelfCheckRule = class RuleSelfCheckRule {
  static id = 'rule-self-check';
  id = RuleSelfCheckRule.id;
  glob = '**/*.rule.ts';

  constructor(_: unknown) {}

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const seenDirs = new Set<string>();

    for (const file of context.files) {
      if (!file.endsWith('.rule.ts')) continue;
      if (file.endsWith('.test.ts')) continue;
      if (file.includes('/test/') || file.includes('\\test\\')) continue;

      // 计算 rule 所在目录
      const lastSep = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
      const dir = lastSep >= 0 ? file.slice(0, lastSep) : '';
      // rule 名 = 文件名(去掉 .rule.ts)
      const baseName = (lastSep >= 0 ? file.slice(lastSep + 1) : file).replace(/\.rule\.ts$/, '');

      // 每个目录只查一次
      const dirKey = `${dir}::${baseName}`;
      if (seenDirs.has(dirKey)) continue;
      seenDirs.add(dirKey);

      const dirAbs = windowSafeJoin(context.targetPath, dir);
      if (!fs.existsSync(dirAbs)) continue;

      // 期望有: <baseName>.README.md 或 README.md
      const readmeCandidates = [
        `${baseName}.README.md`,
        'README.md',
      ];
      const hasReadme = readmeCandidates.some((f) =>
        fs.existsSync(windowSafeJoin(dirAbs, f))
      );

      if (!hasReadme) {
        issues.push({
          type: 'documentation',
          module: baseName,
          file: `${dir}/${baseName}.rule.ts`,
          issue: `Rule '${baseName}' missing README.md — needed for rule marketplace display`,
          expect: `Create ${baseName}/README.md with frontmatter (name, title, tags, severity, status) + TL;DR + usage examples.`,
          level: 'warning',
          fixable: true,
          data: {
            filePath: windowSafeJoin(dirAbs, `${baseName}.README.md`),
            ruleName: baseName,
            ruleDir: dirAbs,
          },
        });
      }

      // 也检查 .rule.ts 文件存在(glob 已保证,但兜底)
      const ruleFileAbs = windowSafeJoin(dirAbs, `${baseName}.rule.ts`);
      if (!fs.existsSync(ruleFileAbs)) {
        issues.push({
          type: 'structure',
          module: baseName,
          file: `${dir}/${baseName}.rule.ts`,
          issue: `Rule '${baseName}' missing <name>.rule.ts implementation`,
          expect: `Create ${baseName}/${baseName}.rule.ts implementing ReviewRule.`,
          level: 'error',
          fixable: false,
        });
      }
    }

    return issues;
  }
};

export default RuleSelfCheckRule;
export { RuleSelfCheckRule };
