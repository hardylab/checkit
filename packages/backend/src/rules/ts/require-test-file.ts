// spec:[spec](specs/backend/rules/require-test-file.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'require-test-file': {};
  }
}

function definesFunctions(content: string): boolean {
  const patterns = [
    /\bfunction\s+\w+\s*\(/, // function declarations
    /\bconst\s+\w+\s*=\s*(async\s*)?function\s*\(/, // function expressions
    /\bconst\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/, // arrow functions
    /\bclass\s+\w+/, // classes (assume methods)
    /(\w+)\s*\([^)]*\)\s*\{/, // object-style methods
  ];
  return patterns.some((re) => re.test(content));
}

export class RequireTestFileRule implements ReviewRule {
  static id = 'require-test-file';
  id = RequireTestFileRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const filesSet = new Set(context.files.map((f) => f.replace(/\\/g, '/')));

    for (const file of context.files) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const filePath = path.join(context.targetPath, file);
      let content = '';
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      if (!definesFunctions(content)) continue;

      const dir = path.dirname(file).replace(/\\/g, '/');
      const dirPrefix = dir === '.' || dir === '' ? '' : dir + '/';
      const base = path.basename(file, '.ts');
      const sameDirTest = `${dirPrefix}${base}.test.ts`;
      const testSubdirTest = `${dirPrefix}test/${base}.test.ts`;

      const hasTest = filesSet.has(sameDirTest) || filesSet.has(testSubdirTest);

      if (!hasTest) {
        issues.push({
          type: 'structure',
          module: context.targetName,
          file,
          issue: `Missing test file '${base}.test.ts' in same directory or 'test/' subdirectory.`,
          expect: `为该模块添加单元测试：在同目录创建 '${base}.test.ts' 或在 'test/' 子目录创建同名测试文件。`,
          level: 'warning',
          fixable: false,
        });
      }
    }
    return issues;
  }
}
