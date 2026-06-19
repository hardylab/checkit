import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentFilesLintFixRule } from '../recent-files-lint-fix/recent-files-lint-fix.rule';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('RecentFilesLintFixRule', () => {
  const ctx: RuleContext = {
    cwd: '/root',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['recent.ts', 'old.ts', 'other.txt'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockImplementation(((p: string) => {
      if (p.includes('recent.ts')) {
        return { mtimeMs: Date.now() };
      }
      return { mtimeMs: Date.now() - 100 * 60 * 1000 }; // 100 mins ago
    }) as any);
  });

  it('checks only recent ts/tsx files', () => {
    const rule = new RecentFilesLintFixRule({ timeWindowMinutes: 60 });
    rule.check(ctx);

    expect(child_process.execSync).toHaveBeenCalledTimes(1);
    const callArgs = (child_process.execSync as any).mock.calls[0];
    expect(callArgs[0]).toContain('recent.ts');
    expect(callArgs[0]).not.toContain('old.ts');
  });

  it('reports issue if eslint fails', () => {
    (child_process.execSync as any).mockImplementation(() => {
      throw new Error('Lint failed');
    });

    const rule = new RecentFilesLintFixRule({ timeWindowMinutes: 60 });
    const issues = rule.check(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('recent.ts');
    expect(issues[0].fixable).toBe(true);
  });

  it('fix runs eslint --fix', () => {
    const rule = new RecentFilesLintFixRule();
    const issue: ReviewIssue = {
      type: 'styling',
      module: 'proj',
      file: 'recent.ts',
      issue: 'msg',
      level: 'warning',
      data: {
        filePath: path.join('/root/target/recent.ts'),
        projectRoot: '/root',
      },
    };

    rule.fix!(issue);
    expect(child_process.execSync).toHaveBeenCalledWith(
      expect.stringContaining('--fix'),
      expect.anything()
    );
  });
});
