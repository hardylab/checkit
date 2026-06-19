import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NoAnyRule } from '../no-any-rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('no-any-rule', () => {
  const mockContext: RuleContext = {
    cwd: '/test/cwd',
    projectRoot: '/test/root',
    targetPath: '/test/target',
    targetName: 'test-project',
    targetType: 'project',
    files: ['a.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('should report issue when "any" is used', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
const a: any = 1;
function foo(b: any) {}
    `.trim()
    );

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(2);
    expect(issues[0].issue).toContain("Avoid using 'any' type");
  });

  it('should not report issue when "any" is disabled on previous line', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
const a: any = 1;
    `.trim()
    );

    const rule = new NoAnyRule({});

    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });

  it('should not report issue when "any" is disabled on same line', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
const a: any = 1; // eslint-disable-line @typescript-eslint/no-explicit-any
    `.trim()
    );

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(0);
  });

  it('should report issue for "as any"', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
const a = b as any;
    `.trim()
    );

    const rule = new NoAnyRule({});

    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(1);
  });

  it('should report issue for generic "<any>"', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
const a = new Map<string, any>();
    `.trim()
    );

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(1);
  });

  it('should ignore "any" in comments', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
// This is an any type
const a = 1;
    `.trim()
    );

    const rule = new NoAnyRule({});
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });

  it('should ignore files that are not ts/tsx', () => {
    const jsContext = { ...mockContext, files: ['a.js'] };

    // Should not read file
    const readSpy = vi.spyOn(fs, 'readFileSync');

    const rule = new NoAnyRule({});
    const issues = rule.check(jsContext);

    expect(issues).toHaveLength(0);

    expect(readSpy).not.toHaveBeenCalled();
  });
});
