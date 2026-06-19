// spec:[spec](specs/backend/rules/file/gitignore-sensitive-required.md#L1)
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'gitignore-sensitive-required': {
      patterns?: string[];
    };
  }
}

type Options = {
  patterns?: string[];
};

export class GitignoreSensitiveRequiredRule implements ReviewRule {
  static id = 'gitignore-sensitive-required';
  id = GitignoreSensitiveRequiredRule.id;
  private options: Options;
  constructor(options: Options = {}) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const defaults = ['node_modules/', '.env', '.env.*'];
    const required = Array.from(new Set([...(this.options.patterns ?? []), ...defaults]));
    const filePath = path.join(context.targetPath, '.gitignore');
    const present = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    const lines = present ? present.split(/\r?\n/) : [];
    const missing = required.filter((p) => !lines.some((l) => l.trim() === p));
    if (missing.length > 0) {
      issues.push({
        type: 'security',
        module: context.targetName,
        file: '.gitignore',
        line: 1,
        issue: `缺少敏感/不必要文件的忽略配置：${missing.join(', ')}`,
        level: 'error',
        fixable: true,
        data: { filePath, missing },
      });
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    const data = issue.data as { filePath?: string; missing?: string[] } | undefined;
    if (!data || !data.filePath || !data.missing || data.missing.length === 0) return false;
    try {
      const content = fs.existsSync(data.filePath) ? fs.readFileSync(data.filePath, 'utf-8') : '';
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const append = data.missing.map((p) => p.trim()).join(eol);
      const final = content
        ? `${content.replace(/\s+$/, '')}${eol}${append}${eol}`
        : `${append}${eol}`;
      fs.writeFileSync(data.filePath, final, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
