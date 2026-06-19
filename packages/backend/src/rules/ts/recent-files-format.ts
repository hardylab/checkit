import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface RecentFilesFormatOptions {
  timeWindowMinutes?: number;
}

export class RecentFilesFormatRule implements ReviewRule {
  static id = 'recent-files-format';
  id = RecentFilesFormatRule.id;
  private options?: RecentFilesFormatOptions;

  constructor(options?: RecentFilesFormatOptions) {
    this.options = options;
  }

  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const timeWindow = (this.options?.timeWindowMinutes ?? 60) * 60 * 1000;
    const now = Date.now();

    for (const file of context.files) {
      const filePath = path.join(context.targetPath, file);
      if (!fs.existsSync(filePath)) continue;

      // Skip if directory
      if (fs.statSync(filePath).isDirectory()) continue;

      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > timeWindow) continue;

      try {
        const prettierPath = this.getPrettierPath(context.projectRoot);
        // Run prettier --check. If it exits with non-zero, formatting is needed.
        execSync(`"${prettierPath}" --check "${filePath}"`, {
          stdio: 'ignore',
          cwd: context.projectRoot,
        });
      } catch (e) {
        issues.push({
          type: 'styling',
          module: context.targetName,
          file,
          issue: 'File is not formatted with Prettier',
          expect: 'File should be formatted with Prettier',
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
      const prettierPath = this.getPrettierPath(projectRoot);
      execSync(`"${prettierPath}" --write "${filePath}"`, { stdio: 'ignore', cwd: projectRoot });
      return true;
    } catch (e) {
      return false;
    }
  }

  private getPrettierPath(projectRoot: string): string {
    const local = path.join(
      projectRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'prettier.cmd' : 'prettier'
    );
    if (fs.existsSync(local)) return local;
    return 'prettier';
  }
}
