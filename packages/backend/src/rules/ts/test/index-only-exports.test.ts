import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexOnlyExportsRule } from '../index-only-exports/index-only-exports.rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');

describe('index-only-exports', () => {
  const base = '/proj/target';
  const rel = path.join('src', 'index.ts');
  const mockContext: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: base,
    targetName: 'mod',
    targetType: 'project',
    files: [rel],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('报告定义语句', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(`export * from "./a";\nconst x = 1`);
    const rule = new IndexOnlyExportsRule({});
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(1);
    expect(issues[0].line).toBe(2);
  });

  it('不报告仅统一导出', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `export { A, B as BB } from "./a";\nexport * from "./b";\nexport type { T } from "./c";`
    );
    const rule = new IndexOnlyExportsRule({});
    const issues = rule.check(mockContext);
    expect(issues).toHaveLength(0);
  });
});
