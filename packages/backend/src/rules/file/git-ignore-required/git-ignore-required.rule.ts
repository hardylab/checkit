// spec:[spec](specs/backend/rules/file/git-ignore-required.md#L1)
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'git-ignore-required': {
      patterns?: string[];
    };
  }
}

type Options = {
  patterns?: string[];
};

const DEFAULT_PATTERNS = [
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  '.turbo/',
  'coverage/',
  '.env',
  '.env.local',
  '.env.*.local',
  '*.log',
  '.DS_Store',
  'Thumbs.db',
  '.vscode/',
  '.idea/',
  '*.swp',
  '*.swo',
  '*~',
];

/**
 * 检查 .gitignore 是否存在且包含必要的模式。
 *
 * 跟 gitignore-sensitive-required 不同:这条规则是"通用卫生",
 * 包含 node_modules / dist / .env / IDE 配置等所有"绝对不该入仓"的模式。
 */
export class GitIgnoreRequiredRule implements ReviewRule {
  static id = 'git-ignore-required';
  id = GitIgnoreRequiredRule.id;
  private options: Options;

  constructor(options: Options = {}) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    const filePath = path.join(context.targetPath, '.gitignore');
    const exists = fs.existsSync(filePath);

    if (!exists) {
      // .gitignore 整个不存在 → error
      issues.push({
        type: 'security',
        module: context.targetName,
        file: '.gitignore',
        line: 1,
        issue: 'Missing .gitignore file — every project must have one',
        expect: 'Create .gitignore with patterns: node_modules/, dist/, .env, *.log, etc.',
        level: 'error',
        fixable: true,
        data: { filePath, missing: 'ALL' },
      });
      return issues;
    }

    const required = Array.from(
      new Set([...(this.options.patterns ?? []), ...DEFAULT_PATTERNS])
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const missing = required.filter((p) => {
      // 简单匹配:精确 / glob 简化
      // node_modules/ → 任意 node_modules 行
      // .env → 任意 .env 行(也覆盖 .env.local 等)
      if (p.endsWith('/')) {
        return !lines.some((l) => l === p || l === p.replace(/\/$/, ''));
      }
      return !lines.some((l) => l === p || l.startsWith(p));
    });

    if (missing.length > 0) {
      issues.push({
        type: 'security',
        module: context.targetName,
        file: '.gitignore',
        line: 1,
        issue: `Missing patterns in .gitignore: ${missing.join(', ')}`,
        expect: 'Add missing patterns to .gitignore',
        level: 'warn',
        fixable: true,
        data: { filePath, missing },
      });
    }

    return issues;
  }

  fix(issue: ReviewIssue): boolean {
    const data = issue.data as { filePath?: string; missing?: string[] | string } | undefined;
    if (!data || !data.filePath || !data.missing) return false;
    try {
      const exists = fs.existsSync(data.filePath);
      const content = exists ? fs.readFileSync(data.filePath, 'utf-8') : '';
      const eol = content.includes('\r\n') ? '\r\n' : '\n';

      if (data.missing === 'ALL') {
        // 创建全新 .gitignore
        const all = DEFAULT_PATTERNS.join(eol) + eol;
        fs.writeFileSync(data.filePath, all, 'utf-8');
        return true;
      }

      // 追加缺失项
      const missingArr = data.missing as string[];
      const append = missingArr.join(eol) + eol;
      const final = content
        ? `${content.replace(/\s+$/, '')}${eol}${append}`
        : append;
      fs.writeFileSync(data.filePath, final, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
