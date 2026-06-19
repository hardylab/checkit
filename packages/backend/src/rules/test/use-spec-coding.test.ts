// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UseSpecCodingRule } from '../file/use-spec-coding';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import { execSync } from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('use-spec-coding rule', () => {
  const mockContext: RuleContext = {
    cwd: '/test/cwd',
    projectRoot: '/test/root',
    targetPath: '/test/target',
    targetName: 'test-project',
    targetType: 'project',
    files: ['package.json'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should report issue when spec coding libs are missing', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        dependencies: { react: '1.0.0' },
        devDependencies: { typescript: '4.0.0' },
      })
    );

    const rule = new UseSpecCodingRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('Spec coding paradigm not found');
    expect(issues[0].fixable).toBe(true);
    expect(issues[0].level).toBe('error');
  });

  it('should not report issue when openspec is present', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        devDependencies: { openspec: '1.0.0' },
      })
    );

    const rule = new UseSpecCodingRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(0);
  });

  it('should not report issue when speckit is present', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        dependencies: { speckit: '1.0.0' },
      })
    );

    const rule = new UseSpecCodingRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(0);
  });

  it('should execute fix command', () => {
    const issue: ReviewIssue = {
      type: 'architecture',
      module: 'test-project',
      issue: 'fix me',
      fixable: true,
      level: 'error',
    };

    const rule = new UseSpecCodingRule({});
    if (rule.fix) {
      rule.fix(issue);
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('pnpm add -D openspec'),
        expect.anything()
      );
    } else {
      throw new Error('Fix function is undefined');
    }
  });
});
