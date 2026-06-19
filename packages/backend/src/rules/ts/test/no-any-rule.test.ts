import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NoAnyRule } from '../no-any-rule/no-any-rule.rule';
import type { RuleContext } from '@checkit/shared';

vi.mock('fs');

describe('no-any-rule (V4)', () => {
  const mockContext: RuleContext = {
    cwd: 'D:/test/cwd',
    projectRoot: 'D:/test/root',
    targetPath: 'D:/test/target',
    targetName: 'test-project',
    targetType: 'project',
    files: ['a.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Windows 路径兼容
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p).replace(/\\/g, '/').includes('D:/test/target/a.ts');
    });
  });

  it('reports any in type annotation', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
const a: any = 1;
const b: string = 'x';
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);

    expect(issues.length).toBe(1);
    expect(issues[0].issue).toContain("'any'");
    expect(issues[0].line).toBe(1);
  });

  it('reports any in function parameter', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
function foo(x: any) { return x; }
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(1);
  });

  it('reports any in generic parameter', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
const m = new Map<string, any>();
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(1);
  });

  it('skips `as any` type assertion (still considered a violation by V3 spec, but practical exception)', () => {
    // V4 设计选择:`as any` 是必要模式(external API 强转),不报告
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
const x = something as any;
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(0);
  });

  it('ignores "any" in comments', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
// this is an any type
const a = 1;
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(0);
  });

  it('ignores "any" in string literals', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
const greeting = "any string";
`.trim());

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(0);
  });

  it('skips test files', () => {
    const testContext = { ...mockContext, files: ['a.test.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('const a: any = 1;');
    const rule = new NoAnyRule({});
    const issues = rule.check(testContext);
    expect(issues.length).toBe(0);
  });

  it('ignores non-TS files', () => {
    const jsContext = { ...mockContext, files: ['a.js'] };
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const rule = new NoAnyRule({});
    const issues = rule.check(jsContext);
    expect(issues.length).toBe(0);
    expect(readSpy).not.toHaveBeenCalled();
  });
});
