import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManyConditionsRule } from '../many-conditions-rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('many-conditions-rule', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['a.ts', 'b.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(path, 'join').mockImplementation((...parts: string[]) => parts.join('/'));
  });

  it('reports long if-else chain', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
function f(x: number) {
  if (x === 1) return 1;
  else if (x === 2) return 2;
  else if (x === 3) return 3;
  else if (x === 4) return 4;
  else if (x === 5) return 5;
  else if (x === 6) return 6;
  else if (x === 7) return 7;
  return 0;
}
`.trim()
    );
    const rule = new ManyConditionsRule({ maxBranches: 5 });
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].issue).toContain('条件分支过多');
    expect(issues[0].expect || '').toContain('策略模式');
    expect(issues[0].expect || '').toContain('职责链');
    expect(issues[0].fixable).toBe(false);
  });

  it('reports long switch-case', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `
function g(x: number) {
  switch (x) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 3;
    case 4: return 4;
    case 5: return 5;
    case 6: return 6;
    default: return 0;
  }
}
`.trim()
    );
    const rule = new ManyConditionsRule({ maxBranches: 5 });
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].issue).toContain('switch-case 分支过多');
    expect(issues[0].expect || '').toContain('表驱动');
    expect(issues[0].expect || '').toContain('状态模式');
  });
});
