// spec:[spec](specs/backend/rules/index-only-exports.md#L1)
import { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'index-only-exports': {};
  }
}

export class IndexOnlyExportsRule implements ReviewRule {
  static id = 'index-only-exports';
  id = IndexOnlyExportsRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const indexFiles = context.files.filter((f) => path.basename(f) === 'index.ts');
    for (const rel of indexFiles) {
      const abs = path.join(context.targetPath, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const eol = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.split(eol);
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] || '';
        const trimmed = raw.trim();
        if (trimmed === '') continue;
        if (trimmed.startsWith('//')) continue;
        if (trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('*/'))
          continue;
        if (isAllowedExportLine(trimmed)) continue;
        issues.push({
          type: 'structure',
          module: context.targetName,
          file: rel,
          line: i + 1,
          issue: `index.ts 仅允许统一导出语句，禁止定义函数、对象或 class`,
          expect: `将 index.ts 中的实现代码移至独立模块文件，并在 index.ts 中仅保留 export 语句进行统一导出。`,
          level: 'error',
        });
      }
    }
    return issues;
  }
}

function isAllowedExportLine(line: string): boolean {
  if (line.startsWith('export * from')) return true;
  if (/^export\s+\{[\s\S]*\}\s+from\s+['"].+['"]/.test(line)) return true;
  if (/^export\s+type\s+\{[\s\S]*\}\s+from\s+['"].+['"]/.test(line)) return true;
  return false;
}
