import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoMagicNumbersRule } from '../no-magic-numbers/no-magic-numbers.rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('no-magic-numbers', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['a.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('reports magic numbers', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('let x=42;');
    const rule = new NoMagicNumbersRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
  });

  it('allows configured numbers', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('let x=42;');
    const rule = new NoMagicNumbersRule({ allow: [42] });
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
