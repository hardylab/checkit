// spec:[spec](specs/backend/rules/env-var-check.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

export interface EnvVarCheckOptions {
  allow?: string[];
}

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'env-var-check': EnvVarCheckOptions;
  }
}

export class EnvVarCheckRule implements ReviewRule {
  static id = 'env-var-check';
  id = EnvVarCheckRule.id;
  private options?: EnvVarCheckOptions;
  constructor(options?: EnvVarCheckOptions) {
    this.options = options;
  }
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const allow = this.options?.allow ?? [];
    const re = /process\.env\.([A-Z0-9_]+)/g;
    for (const file of context.files) {
      if (
        !file.endsWith('.ts') &&
        !file.endsWith('.tsx') &&
        !file.endsWith('.js') &&
        !file.endsWith('.jsx')
      )
        continue;
      if (/(^|[\\/])test([\\/]|$)/.test(file)) continue;
      const fp = path.join(context.targetPath, file);
      if (!fs.existsSync(fp)) continue;
      const content = fs.readFileSync(fp, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let m: RegExpExecArray | null;
        re.lastIndex = 0;
        while ((m = re.exec(line)) !== null) {
          const key = m[1];
          if (!allow.includes(key)) {
            issues.push({
              type: 'architecture',
              module: context.targetName,
              file,
              line: i + 1,
              issue: `Direct env access: ${key}`,
              expect: `避免直接访问 process.env；改为通过配置模块或依赖注入读取 '${key}'，统一管理环境变量入口。`,
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
