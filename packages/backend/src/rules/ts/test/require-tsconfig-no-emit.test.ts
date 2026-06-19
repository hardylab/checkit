import { describe, it, expect, vi } from 'vitest';
import { RequireTsconfigNoEmitRule } from '../require-tsconfig-no-emit';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('require-tsconfig-no-emit', () => {
  const ctx: RuleContext = {
    cwd: 'D:/cwd',
    projectRoot: 'D:/root',
    targetPath: 'D:/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['packages/backend/tsconfig.json'],
    autoFix: true,
  };

  it('reports and fixes missing noEmit', () => {
    const abs = path.join(ctx.targetPath, ctx.files[0]);
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === abs);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        compilerOptions: { composite: true },
      })
    );
    const writeMock = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const rule = new RequireTsconfigNoEmitRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBe(1);
    const issue = issues[0] as ReviewIssue;
    expect(issue.fixable).toBe(true);
    const fixed = rule.fix(issue);
    expect(fixed).toBe(true);
    expect(writeMock).toHaveBeenCalled();
    const written = (writeMock.mock.calls[0]?.[1] as string) || '';
    expect(written.includes('"noEmit": true')).toBe(true);
  });
});
