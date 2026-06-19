import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequireTestFileRule } from '../require-test-file';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('require-test-file rule', () => {
  const ctxBase: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: [],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('reports missing test in same dir or test subdir when functions exist', () => {
    const ctx = { ...ctxBase, files: ['a.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('export function foo() { return 1; }');
    const rule = new RequireTestFileRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain("Missing test file 'a.test.ts'");
  });

  it('passes when same-dir test exists', () => {
    const ctx = { ...ctxBase, files: ['a.ts', 'a.test.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('const bar = () => 1;');
    const rule = new RequireTestFileRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });

  it('passes when test subdir file exists', () => {
    const ctx = { ...ctxBase, files: ['src/a.ts', 'src/test/a.test.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('class C { m() { return 1; } }');
    const rule = new RequireTestFileRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });

  it('ignores files without functions', () => {
    const ctx = { ...ctxBase, files: ['b.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('const x = 1;');
    const rule = new RequireTestFileRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
