import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface RecentFilesLintFixOptions {
  timeWindowMinutes?: number;
}

export class RecentFilesLintFixRule implements ReviewRule {
  static id = 'recent-files-lint-fix';
  id = RecentFilesLintFixRule.id;
  private options?: RecentFilesLintFixOptions;

  constructor(options?: RecentFilesLintFixOptions) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const timeWindow = (this.options?.timeWindowMinutes ?? 60) * 60 * 1000;
    const now = Date.now();

    for (const file of context.files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > timeWindow) continue;

      try {
        const eslintPath = this.getEslintPath(context.projectRoot);
        // Run eslint to check. If it exits with 1, there are errors.
        execSync(`"${eslintPath}" "${filePath}"`, { stdio: 'ignore', cwd: context.projectRoot });
      } catch (e) {
        issues.push({
          type: 'styling',
          module: context.targetName,
          file,
          issue: 'ESLint issues found in recently modified file',
          expect: 'ESLint issues should be resolved (auto-fix available)',
          level: 'warning',
          fixable: true,
          data: {
            filePath,
            projectRoot: context.projectRoot,
          },
        });
      }
    }
    return issues;
  }

  fix(issue: ReviewIssue): boolean {
    const filePath = issue.data?.filePath as string;
    const projectRoot = issue.data?.projectRoot as string;

    if (!filePath || !projectRoot) return false;

    try {
      const eslintPath = this.getEslintPath(projectRoot);
      execSync(`"${eslintPath}" --fix "${filePath}"`, { stdio: 'ignore', cwd: projectRoot });
      return true;
    } catch (e) {
      return false;
    }
  }

  private getEslintPath(projectRoot: string): string {
    const local = path.join(
      projectRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
    );
    if (fs.existsSync(local)) return local;
    return 'eslint';
  }
}
