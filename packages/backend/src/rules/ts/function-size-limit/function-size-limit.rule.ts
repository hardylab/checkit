// spec:[spec](specs/backend/rules/function-size-limit.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

export interface FunctionSizeOptions {
  maxLines?: number;
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'function-size-limit': FunctionSizeOptions;
  }
}

export class FunctionSizeLimitRule implements ReviewRule {
  static id = 'function-size-limit';
  id = FunctionSizeLimitRule.id;
  private options?: FunctionSizeOptions;
  constructor(options?: FunctionSizeOptions) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const maxLines = this.options?.maxLines ?? 50;
    const startRe =
      /(function\s+\w+\s*\(|const\s+\w+\s*=\s*\(|\w+\s*=\s*async\s*\(|async\s+function\s+\w+\s*\()/;
    for (const file of context.files) {
      if (
        !file.endsWith('.ts') &&
        !file.endsWith('.tsx') &&
        !file.endsWith('.js') &&
        !file.endsWith('.jsx')
      )
        continue;
      const fp = path.join(context.targetPath, file);
      if (!fs.existsSync(fp)) continue;
      const content = fs.readFileSync(fp, 'utf-8');
      const lines = content.split(/\r?\n/);
      let depth = 0;
      let inFunc = false;
      let funcStart = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!inFunc && startRe.test(line)) {
          inFunc = true;
          funcStart = i;
        }
        for (const ch of line) {
          if (ch === '{') depth++;
          if (ch === '}') depth--;
        }
        if (inFunc && depth === 0) {
          const size = i - funcStart + 1;
          if (size > maxLines) {
            issues.push({
              type: 'architecture',
              module: context.targetName,
              file,
              line: funcStart + 1,
              issue: `Function too large: ${size} lines`,
              expect: `将该函数拆分为更小的单元（单一职责），提取子函数或模块化逻辑，目标不超过 ${maxLines} 行。`,
              level: 'warning',
              fixable: false,
            });
          }
          inFunc = false;
        }
      }
    }
    return issues;
  }
}
