// spec:[spec](specs/backend/rules/no-console-log.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'no-console-log': {};
  }
}

export class NoConsoleLogRule implements ReviewRule {
  static id = 'no-console-log';
  id = NoConsoleLogRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    for (const file of context.files) {
      if (
        (!file.endsWith('.ts') &&
          !file.endsWith('.tsx') &&
          !file.endsWith('.js') &&
          !file.endsWith('.jsx')) ||
        /(^|[\\/])(test|dist|node_modules)([\\/]|$)/.test(file)
      ) {
        continue;
      }
      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.split(eol);
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] || '';
        if (/console\.log\s*\(/.test(raw)) {
          issues.push({
            type: 'structure',
            module: context.targetName,
            file,
            line: i + 1,
            issue: 'console.log detected',
            level: 'warning',
            fixable: true,
            data: { filePath, lineNumber: i + 1 },
          });
        }
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    const p = issue.data && (issue.data.filePath as string);
    const ln = issue.data && (issue.data.lineNumber as number);
    if (!p || !ln) return false;
    try {
      const content = fs.readFileSync(p, 'utf-8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.split(eol);
      const idx = ln - 1;
      lines[idx] = lines[idx].replace(/console\.log\s*\([^)]*\);?/, '');
      fs.writeFileSync(p, lines.join(eol), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
