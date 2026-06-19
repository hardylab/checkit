import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabSizeTwoSpacesRule } from '../tab-size-two-spaces/tab-size-two-spaces.rule';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('tab-size-two-spaces rule', () => {
  const ctx: RuleContext = {
    cwd: '/root',
    projectRoot: '/root',
    targetPath: '/root/src',
    targetName: 'proj',
    targetType: 'project',
    files: ['a.ts', 'b.json', 'c.css'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(path, 'join').mockImplementation((...parts: string[]) => parts.join('/'));
  });

  it('reports tabs and allows fix', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('\tconst a = 1;\n  \treturn a;\n');
    const rule = new TabSizeTwoSpacesRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    const fixable = issues.filter((i) => i.fixable);
    expect(fixable.length).toBeGreaterThan(0);
    const issue: ReviewIssue = fixable[0];
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    const ok = rule.fix(issue);
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('/root/src/'),
      expect.stringContaining('  const a = 1;'),
      'utf-8'
    );
  });

  it('reports odd spaces as error without fix', () => {
    const localCtx: RuleContext = { ...ctx, files: ['odd.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('   const x = 1;\n');
    const rule = new TabSizeTwoSpacesRule({});
    const issues = rule.check(localCtx);
    expect(issues).toHaveLength(1);
    expect(issues[0].fixable).toBe(false);
    expect(issues[0].issue).toContain('2 个空格的倍数');
  });

  it('passes for proper two-space indentation', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      'const a = 1;\n  const b = 2;\n    const c = 3;\n'
    );
    const rule = new TabSizeTwoSpacesRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
