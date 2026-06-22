import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/cli';

class NoLodashRule implements ReviewRule {
  static id = 'no-lodash';
  id = 'no-lodash';
  glob = '**/*.{ts,tsx}';
  level = 'warn' as const;

  check(ctx: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    for (const file of ctx.files) {
      // Skip our own rule + .checkit config dir (would loop on itself)
      if (file.startsWith('.checkit/')) continue;

      const abs = path.join(ctx.targetPath, file);
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;  // EISDIR guard

      const text = fs.readFileSync(abs, 'utf-8');
      const lines = text.split('\n');
      lines.forEach((line: string, i: number) => {
        if (/from\s+['"]lodash/.test(line)) {
          issues.push({
            type: 'no-lodash', module: 'no-lodash', file, line: i + 1,
            issue: "Banned import 'lodash' — use native ES utilities instead",
            expect: 'Replace lodash with native Array/Object methods',
            level: 'warn',
          });
        }
      });
    }
    return issues;
  }
}

export default NoLodashRule;