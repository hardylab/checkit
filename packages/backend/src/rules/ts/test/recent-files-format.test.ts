import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecentFilesFormatRule } from '../recent-files-format';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('RecentFilesFormatRule', () => {
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
      // isDirectory check
      if (p.endsWith('dir')) return { isDirectory: () => true, mtimeMs: 0 };

      const stats = { isDirectory: () => false };
      if (p.includes('recent.ts') || p.includes('other.txt')) {
        Object.assign(stats, { mtimeMs: Date.now() });
      } else {
        Object.assign(stats, { mtimeMs: Date.now() - 100 * 60 * 1000 });
      }
      return stats;
    }) as any);
  });

  it('checks only recent files', () => {
    const rule = new RecentFilesFormatRule({ timeWindowMinutes: 60 });
    rule.check(ctx);

    // recent.ts and other.txt are recent
    expect(child_process.execSync).toHaveBeenCalledTimes(2);
  });

  it('reports issue if prettier fails', () => {
    (child_process.execSync as any).mockImplementation(() => {
      throw new Error('Format needed');
    });

    const rule = new RecentFilesFormatRule({ timeWindowMinutes: 60 });
    const issues = rule.check(ctx);

    expect(issues).toHaveLength(2); // recent.ts and other.txt
    expect(issues[0].fixable).toBe(true);
  });

  it('fix runs prettier --write', () => {
    const rule = new RecentFilesFormatRule();
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
      expect.stringContaining('--write'),
      expect.anything()
    );
  });
});
