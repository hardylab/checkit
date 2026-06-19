// spec:[spec](specs/backend/rules/file/tab-size-two-spaces.md#L1)
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'tab-size-two-spaces': {
      includeExtensions?: string[];
      excludePatterns?: string[];
    };
  }
}

type Options = {
  includeExtensions?: string[];
  excludePatterns?: string[];
};

export class TabSizeTwoSpacesRule implements ReviewRule {
  static id = 'tab-size-two-spaces';
  id = TabSizeTwoSpacesRule.id;
  private options: Options;
  constructor(options: Options) {
    this.options = options || {};
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const include =
      this.options.includeExtensions && this.options.includeExtensions.length > 0
        ? new Set(this.options.includeExtensions.map((e) => (e.startsWith('.') ? e : `.${e}`)))
        : new Set(['.ts', '.tsx', '.css', '.less', '.yaml', '.yml', '.json']);
    const excludes = this.options.excludePatterns || [];
    for (const rel of context.files) {
      const ext = path.extname(rel).toLowerCase();
      if (!include.has(ext)) continue;
      if (excludes.some((p) => rel.includes(p))) continue;
      const filePath = path.join(context.targetPath, rel);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = line.match(/^([ \t]+)/);
        if (!m) continue;
        const ws = m[1];
        const hasTab = ws.includes('\t');
        if (hasTab) {
          issues.push({
            type: 'styling',
            module: context.targetName,
            file: rel,
            line: i + 1,
            issue: '缩进必须使用空格（禁止 Tab），并且每层缩进为 2 个空格',
            level: 'error',
            fixable: true,
            data: { filePath },
          });
          continue;
        }
        const spaceCount = ws.length;
        if (spaceCount % 2 !== 0) {
          issues.push({
            type: 'styling',
            module: context.targetName,
            file: rel,
            line: i + 1,
            issue: '缩进必须为 2 个空格的倍数',
            level: 'error',
            fixable: false,
          });
        }
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    const data = issue.data as { filePath?: string } | undefined;
    if (!data || !data.filePath) return false;
    try {
      const content = fs.readFileSync(data.filePath, 'utf-8');
      const fixed = content.replace(/^([ \t]+)/gm, (all) => {
        let count = 0;
        for (let i = 0; i < all.length; i++) {
          count += all[i] === '\t' ? 2 : 1;
        }
        return ' '.repeat(count);
      });
      fs.writeFileSync(data.filePath, fixed, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
