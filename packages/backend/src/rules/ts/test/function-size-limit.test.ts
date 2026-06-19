import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionSizeLimitRule } from '../function-size-limit';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('function-size-limit', () => {
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

  it('reports oversized function', () => {
    const body = '{\n' + Array(60).fill('x;').join('\n') + '\n}';
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`function foo() ${body}`);
    const rule = new FunctionSizeLimitRule({ maxLines: 50 });
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('passes for small function', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('function foo(){ return 1; }');
    const rule = new FunctionSizeLimitRule({ maxLines: 50 });
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
