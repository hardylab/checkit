// spec:[spec](specs/backend/rules/file/use-spec-coding.md#L1)
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'use-spec-coding': {};
  }
}

export class UseSpecCodingRule implements ReviewRule {
  static id = 'use-spec-coding';
  id = UseSpecCodingRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const packageJsonPath = path.join(context.targetPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      if (context.targetType === 'project' || context.targetType === 'root') {
        return [];
      }
      return [];
    }
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const hasSpecKit = deps['speckit'] || deps['openspec'] || deps['openspec-cn'];
      if (!hasSpecKit) {
        return [
          {
            type: 'architecture',
            module: context.targetName,
            file: 'package.json',
            issue: 'Spec coding paradigm not found. Install "speckit" or "openspec".',
            fixable: true,
            level: 'error',
          },
        ];
      }
    } catch (e) {
      console.error(`Failed to parse package.json at ${packageJsonPath}`, e);
    }
    return [];
  }
  fix(issue: ReviewIssue): boolean {
    void issue;
    try {
      execSync('pnpm add -D openspec', { stdio: 'inherit' });
      return true;
    } catch (e) {
      console.error('Failed to install openspec', e);
      return false;
    }
  }
}
