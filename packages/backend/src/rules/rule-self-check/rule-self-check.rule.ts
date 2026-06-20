// spec:[spec](specs/backend/rules/rule-self-check.md)
import fs from 'fs';
import type { ReviewIssue, RuleContext } from '@checkit/shared';
import { windowSafeJoin } from '../_shared/utils';

/**
 * Rule self-check 规则
 *
 * 检查每个 rule 文件夹**至少包含**:
 * - <name>.rule.ts(rule 实现)
 * - <name>.md(规则说明,给规则商城 + Obsidian wiki 链接用)
 *
 * 设计选择:用 <name>.md 而非 README.md 是为了:
 * 1. Obsidian 中直接用 `[[<rule-name>]]` wiki 链接
 * 2. 跨文件夹引用语义清晰
 * 3. 文件名 = 规则名,不需要读目录就知道是什么
 *
 * 这是 checkit 自身的元规则(meta-rule)。
 * 用于自举(self-bootstrapping)时,确保每个内置规则都有完整文档。
 *
 * glob: 任意层 *.rule.ts(命中每个 rule 文件)
 * 触发:该 rule 所在文件夹缺 <name>.md
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

      // 严格只认 <baseName>.md(为了 Obsidian wiki 链接 + 跨工具兼容)
      const docPath = windowSafeJoin(dirAbs, `${baseName}.md`);
      const hasDoc = fs.existsSync(docPath);

      if (!hasDoc) {
        issues.push({
          type: 'documentation',
          module: baseName,
          file: `${dir}/${baseName}.rule.ts`,
          issue: `Rule '${baseName}' missing <name>.md — needed for rule marketplace display and Obsidian wiki links`,
          expect: `Create ${baseName}/${baseName}.md with frontmatter (name, title, tags, severity, status) + TL;DR + usage examples.`,
          level: 'warning',
          fixable: true,
          data: {
            filePath: docPath,
            ruleName: baseName,
            ruleDir: dirAbs,
            // 提示 AI-Fix 工具:目标文件名是 <name>.md
            expectedFileName: `${baseName}.md`,
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
