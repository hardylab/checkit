// spec:[spec](specs/backend/rules/file/gitignore-sensitive-required.md#L1)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitignoreSensitiveRequiredRule } from '../gitignore-sensitive-required/gitignore-sensitive-required.rule';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('gitignore-sensitive-required', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['src/a.ts'],
    autoFix: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reports missing patterns and fixes by appending', () => {
    const gitignorePath = path.join(ctx.targetPath, '.gitignore');
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => p === gitignorePath);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('dist/\n');
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const rule = new GitignoreSensitiveRequiredRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    const fixed = rule.fix!(issues[0] as ReviewIssue);
    expect(fixed).toBe(true);
    const written = writeSpy.mock.calls[0][1] as string;
    expect(written).toContain('node_modules/');
    expect(written).toContain('.env');
    expect(written).toContain('.env.*');
  });
});
