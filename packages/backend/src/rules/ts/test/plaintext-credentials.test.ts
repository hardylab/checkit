// spec:[spec](specs/backend/rules/ts/plaintext-credentials.md#L1)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaintextCredentialsRule } from '../plaintext-credentials';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('plaintext-credentials', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['src/a.ts', 'test/b.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('reports plaintext credentials in code', () => {
    const filePath = path.join(ctx.targetPath, 'src/a.ts');
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p === filePath) return `const apiKey = "ABCDEF1234567890";`;
      return '';
    });
    const rule = new PlaintextCredentialsRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('security');
    expect(issues[0].file).toBe('src/a.ts');
  });

  it('ignores test directory', () => {
    const testPath = path.join(ctx.targetPath, 'test/b.ts');
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p === testPath) return `const password = "secret";`;
      return '';
    });
    const rule = new PlaintextCredentialsRule({});
    const issues = rule.check({ ...ctx, files: ['test/b.ts'] });
    expect(issues).toHaveLength(0);
  });
});
