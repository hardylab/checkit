// spec:[spec](specs/backend/rules/no-magic-numbers.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

export interface MagicNumbersOptions {
  allow?: number[];
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'no-magic-numbers': MagicNumbersOptions;
  }
}

export class NoMagicNumbersRule implements ReviewRule {
  static id = 'no-magic-numbers';
  id = NoMagicNumbersRule.id;
  private options?: MagicNumbersOptions;
  constructor(options?: MagicNumbersOptions) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const allow = this.options?.allow ?? [0, 1, -1];
    const re = /(^|[^A-Za-z0-9_])(-?\d+(\.\d+)?)(?![A-Za-z0-9_])/g;
    for (const file of context.files) {
      if (/(^|[\\/])test([\\/]|$)/.test(file)) continue;
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
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/const\s+[A-Za-z0-9_]+\s*=/.test(line)) continue;
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(line)) !== null) {
          const val = Number(m[2]);
          if (!Number.isNaN(val) && !allow.includes(val)) {
            issues.push({
              type: 'styling',
              module: context.targetName,
              file,
              line: i + 1,
              issue: `Magic number: ${m[2]}`,
              expect:
                '将该数字提取为具名常量或枚举值，并在代码中引用该常量以提升可读性与可维护性。',
              level: 'warning',
              fixable: false,
            });
          }
        }
      }
    }
    return issues;
  }
}
