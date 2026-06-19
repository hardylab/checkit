import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvVarCheckRule } from '../env-var-check';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('env-var-check', () => {
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

  it('reports direct env access', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('const x=process.env.API_KEY;');
    const rule = new EnvVarCheckRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
  });

  it('allows configured keys', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('const x=process.env.API_KEY;');
    const rule = new EnvVarCheckRule({ allow: ['API_KEY'] });
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
