// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupTestFilesRule } from '../file/group-test-files/group-test-files.rule';
import type { RuleContext, ReviewIssue } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('group-test-files rule', () => {
  const mockContext: RuleContext = {
    cwd: '/test/cwd',
    projectRoot: '/test/root',
    targetPath: '/test/target',
    targetName: 'test-project',
    targetType: 'project',
    files: ['a.test.ts', 'b.test.ts', 'c.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should report issue when 2 or more test files exist in the same directory and no test directory exists', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(mockContext);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('Found 2 test files');
    expect(issues[0].fixable).toBe(true);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].data).toBeDefined();
    expect(issues[0].data?.testFiles).toEqual(['a.test.ts', 'b.test.ts']);
    // On Windows, path.join normalizes separators
    expect(issues[0].data?.targetPath).toBe(path.normalize('/test/target'));
    expect(issues[0].data?.destinationDir).toBe('test');
  });

  it('should report issue when 1 test file exists and test directory exists', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      return typeof p === 'string' && p.endsWith(path.sep + 'test');
    });

    const context = { ...mockContext, files: ['a.test.ts', 'c.ts'] };
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(context);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('Found 1 test files');
    expect(issues[0].issue).toContain("existing 'test/' directory");
    expect(issues[0].data?.destinationDir).toBe('test');
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  it('should suggest moving to __tests__ when it exists', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      return typeof p === 'string' && p.endsWith('__tests__');
    });

    const context = { ...mockContext, files: ['a.test.ts', 'c.ts'] };
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(context);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain("existing '__tests__/' directory");
    expect(issues[0].data?.destinationDir).toBe('__tests__');
  });

  it('should not report issue when less than 2 test files exist', () => {
    const context = { ...mockContext, files: ['a.test.ts', 'c.ts'] };
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(context);

    expect(issues).toHaveLength(0);
  });

  it('should report issue for nested directory with multiple test files', () => {
    const context = {
      ...mockContext,
      files: ['src/a.test.ts', 'src/b.test.ts', 'src/c.ts', 'other/d.ts'],
    };
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(context);

    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('Found 2 test files');
    // Using path.join to simulate OS-specific separator expectation in the rule output
    const expectedPath = path.join('/test/target', 'src');
    expect(issues[0].data?.targetPath).toBe(expectedPath);
    expect(issues[0].data?.testFiles).toEqual(['a.test.ts', 'b.test.ts']);
  });

  it('should not report issue when files are already in test directory', () => {
    const context = { ...mockContext, targetPath: '/test/target/test' };
    const rule = new GroupTestFilesRule({});
    const issues = rule.check(context);
    expect(issues).toHaveLength(0);
  });

  it('should execute fix command', () => {
    const issue: ReviewIssue = {
      type: 'structure',
      module: 'test-project',
      issue: 'fix me',
      fixable: true,
      level: 'warning',
      data: {
        targetPath: '/test/target',
        testFiles: ['a.test.ts', 'b.test.ts'],
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    // Mock existsSync to return false for directory (trigger mkdir) and true for files (trigger rename)
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      // Check if path ends with 'test' directory
      if (typeof p === 'string' && p.endsWith(path.sep + 'test')) {
        return false;
      }
      return true;
    });

    // Mock readFileSync to return empty content to avoid crash
    vi.spyOn(fs, 'readFileSync').mockReturnValue('');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const rule = new GroupTestFilesRule({});
    if (rule.fix) {
      const result = rule.fix(issue);
      expect(result).toBe(true);

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join('/test/target', 'test'), {
        recursive: true,
      });

      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join('/test/target', 'a.test.ts'),
        path.join('/test/target', 'test', 'a.test.ts')
      );

      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join('/test/target', 'b.test.ts'),
        path.join('/test/target', 'test', 'b.test.ts')
      );
    }
  });

  it('should update import paths when moving files', () => {
    const issue: ReviewIssue = {
      type: 'structure',
      module: 'test-project',
      issue: 'fix me',
      fixable: true,
      level: 'warning',
      data: {
        targetPath: '/test/target',
        testFiles: ['a.test.ts'],
      },
    };

    // Mock file content with imports
    const fileContent = `
      import { foo } from '../foo';
      import { bar } from '../../bar';
      import { baz } from 'external-lib';
      const x = require('../x');
    `;

    vi.spyOn(fs, 'readFileSync').mockReturnValue(fileContent);
    const writeSpy = vi.spyOn(fs, 'writeFileSync');
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    const rule = new GroupTestFilesRule({});
    if (rule.fix) {
      rule.fix(issue);

      expect(writeSpy).toHaveBeenCalled();
      const writtenContent = writeSpy.mock.calls[0][1] as string;

      expect(writtenContent).toContain("from '../../foo'");
      expect(writtenContent).toContain("from '../../../bar'");
      expect(writtenContent).toContain("from 'external-lib'"); // Should not change
      expect(writtenContent).toContain("require('../../x')");
    }
  });
});
