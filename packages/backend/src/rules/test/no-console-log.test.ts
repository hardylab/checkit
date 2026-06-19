import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoConsoleLogRule } from '../ts/no-console-log/no-console-log.rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('no-console-log', () => {
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

  it('reports console.log', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('console.log("x")');
    const rule = new NoConsoleLogRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
  });

  it('fix removes console.log', () => {
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(fs, 'readFileSync').mockReturnValue('\nconst a=1;');
    const rule = new NoConsoleLogRule({});
    const ok = rule.fix({
      type: 'structure',
      module: 'proj',
      file: 'a.ts',
      line: 1,
      issue: '',
      level: 'warning',
      fixable: true,
      data: { filePath: '/root/target/a.ts', lineNumber: 1 },
    });
    expect(ok).toBe(true);
    expect(write).toHaveBeenCalled();
  });
});
