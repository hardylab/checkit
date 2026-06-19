import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoCircularDependencyRule } from '../ts/no-circular-dependency';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('no-circular-dependency', () => {
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
    vi.spyOn(path, 'normalize').mockImplementation((p: string) => p);
    vi.spyOn(path, 'dirname').mockImplementation((p: string) =>
      p.split('/').slice(0, -1).join('/')
    );
  });

  it('detects simple cycle', () => {
    vi.spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => 'import "./b";')
      .mockImplementationOnce(() => 'import "./a";');
    const rule = new NoCircularDependencyRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].issue).toContain('Circular dependency');
  });
});
