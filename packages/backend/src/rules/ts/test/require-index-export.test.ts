import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequireIndexExportRule } from '../require-index-export';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('require-index-export', () => {
  const base = '/proj/target';
  const mockContext: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: base,
    targetName: 'mod',
    targetType: 'project',
    files: ['src/a.ts', 'src/b.tsx', 'src/index.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) =>
      p.toString().endsWith('index.ts')
    );
  });

  it('报告缺少 index.ts', () => {
    const ctx: RuleContext = {
      ...mockContext,
      files: ['src/a.ts', 'src/b.tsx'],
    };
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const rule = new RequireIndexExportRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('缺少 index.ts');
    expect(issues[0].file).toBe(path.join('src', 'index.ts'));
  });

  it('报告未统一导出缺失模块', () => {
    const indexPath = path.join(base, 'src', 'index.ts');
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => p.toString() === indexPath);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`export * from "./a";`);
    const rule = new RequireIndexExportRule({});
    const issues = rule.check(mockContext);
    expect(issues.find((i) => i.issue.includes('./b'))).toBeTruthy();
  });

  it('不报告当全部导出存在', () => {
    const indexPath = path.join(base, 'src', 'index.ts');
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => p.toString() === indexPath);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`export * from "./a";\nexport { x } from "./b";`);
    const rule = new RequireIndexExportRule({});
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });
});
