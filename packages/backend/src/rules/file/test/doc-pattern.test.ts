import { describe, it, expect, beforeEach } from 'vitest';
import { DocPatternRule } from '../doc-pattern/doc-pattern.rule';
import type { RuleContext, DocPatternChecker } from '@checkit/shared';
import fs from 'fs';
import { vi } from 'vitest';

describe('DocPatternRule', () => {
  let mockExistsSync: any;
  let mockReadFileSync: any;

  beforeEach(() => {
    mockExistsSync = vi.spyOn(fs, 'existsSync');
    mockReadFileSync = vi.spyOn(fs, 'readFileSync');
  });

  const baseContext: RuleContext = {
    cwd: '/root',
    projectRoot: '/root',
    targetPath: '/root',
    targetName: 'test-project',
    targetType: 'project',
    files: [],
    autoFix: false,
  };

  it('should pass when no config is provided', () => {
    const rule = new DocPatternRule(undefined);
    const context = { ...baseContext, files: [] };
    const issues = rule.check(context);
    expect(issues).toHaveLength(0);
  });

  it('should report missing file with boolean true', () => {
    mockExistsSync.mockReturnValue(false);
    const rule = new DocPatternRule({
      'README.md': true,
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('missing');
    expect(issues[0].file).toBe('README.md');
  });

  it('should pass when file exists with boolean true', () => {
    mockExistsSync.mockReturnValue(true);
    const rule = new DocPatternRule({
      'README.md': true,
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(0);
  });

  it('should validate content with function pattern', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('content with rule one');
    const checker: DocPatternChecker = (content: string) => /rule one/.test(content);
    const rule = new DocPatternRule({
      '100-idea.md': checker,
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(0);
  });

  it('should fail when content does not match function pattern', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('some other content');
    const checker: DocPatternChecker = (content: string) => /rule one/.test(content);
    const rule = new DocPatternRule({
      '100-idea.md': checker,
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('does not meet content requirements');
  });

  it('should report missing nested file in subdirectory', () => {
    mockExistsSync.mockImplementation((filePath: any) => {
      if (typeof filePath === 'string') {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return normalizedPath === '/root/src';
      }
      return false;
    });
    const rule = new DocPatternRule({
      src: {
        'index.ts': true,
      },
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('src/index.ts');
  });

  it('should support arbitrary directory names', () => {
    mockExistsSync.mockImplementation((filePath: any) => {
      if (typeof filePath === 'string') {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return normalizedPath === '/root/docs' || normalizedPath === '/root/packages';
      }
      return false;
    });
    const rule = new DocPatternRule({
      docs: {
        '100-idea.md': true,
        '200-mvp.md': true,
      },
      packages: {
        frontend: true,
        backend: true,
      },
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(4);
  });

  it('should validate nested file content with function', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('export const version = "1.0.0"');
    const checker: DocPatternChecker = (content: string) => content.includes('export');
    const rule = new DocPatternRule({
      src: {
        'version.ts': checker,
      },
    });
    const issues = rule.check(baseContext);
    expect(issues).toHaveLength(0);
  });
});
