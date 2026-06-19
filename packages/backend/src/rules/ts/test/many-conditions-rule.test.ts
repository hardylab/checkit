import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ManyConditionsRule } from '../many-conditions-rule';
import type { RuleContext } from '@checkit/shared';

vi.mock('fs');

describe('many-conditions-rule (V4)', () => {
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
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p).replace(/\\/g, '/').includes('D:/test/target/a.ts');
    });
  });

  it('reports long if-else chain', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
if (a) { x = 1; }
else if (b) { x = 2; }
else if (c) { x = 3; }
else if (d) { x = 4; }
else if (e) { x = 5; }
else if (f) { x = 6; }
`.trim());

    const rule = new ManyConditionsRule({ maxBranches: 6 });
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(1);
    expect(issues[0].issue).toContain('if-else chain too long');
    expect(issues[0].issue).toContain('6');
  });

  it('does not report short if-else chain', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
if (a) { x = 1; }
else if (b) { x = 2; }
else if (c) { x = 3; }
`.trim());

    const rule = new ManyConditionsRule({ maxBranches: 6 });
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(0);
  });

  it('reports long switch statement', () => {
    const cases = Array.from({ length: 7 }, (_, i) => `case ${i}: x = ${i}; break;`).join('\n');
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
switch (x) {
${cases}
}
`.trim());

    const rule = new ManyConditionsRule({ maxBranches: 6 });
    const issues = rule.check(mockContext);
    expect(issues.length).toBe(1);
    expect(issues[0].issue).toContain('switch statement too long');
  });

  it('skips test files', () => {
    const testContext = { ...mockContext, files: ['a.test.ts'] };
    vi.spyOn(fs, 'readFileSync').mockReturnValue('if(a){}else if(b){}else if(c){}else if(d){}else if(e){}else if(f){}');
    const rule = new ManyConditionsRule({});
    const issues = rule.check(testContext);
    expect(issues.length).toBe(0);
  });

  it('ignores non-TS files', () => {
    const jsContext = { ...mockContext, files: ['a.js'] };
    const readSpy = vi.spyOn(fs, 'readFileSync');
    const rule = new ManyConditionsRule({});
    const issues = rule.check(jsContext);
    expect(issues.length).toBe(0);
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('reports English error message (V4 spec)', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`
if (a) { x = 1; }
else if (b) { x = 2; }
else if (c) { x = 3; }
else if (d) { x = 4; }
else if (e) { x = 5; }
else if (f) { x = 6; }
`.trim());

    const rule = new ManyConditionsRule({});
    const issues = rule.check(mockContext);
    expect(issues[0].issue).toMatch(/^if-else chain too long/);
  });
});
