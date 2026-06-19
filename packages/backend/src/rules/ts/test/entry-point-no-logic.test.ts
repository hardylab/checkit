import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntryPointNoLogicRule } from '../entry-point-no-logic/entry-point-no-logic.rule';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('entry-point-no-logic', () => {
  const ctx: RuleContext = {
    cwd: '/root',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['main.ts', 'other.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
  });

  it('reports function declaration in main.ts', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('main.ts')) return `function foo() {}`;
      return '';
    });
    const rule = new EntryPointNoLogicRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('main.ts');
    expect(issues[0].issue).toContain('FunctionDeclaration detected');
  });

  it('reports arrow function in main.ts', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('main.ts')) return `const foo = () => {};`;
      return '';
    });
    const rule = new EntryPointNoLogicRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('ArrowFunction detected');
  });

  it('reports class declaration in main.ts', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('main.ts')) return `class Foo {}`;
      return '';
    });
    const rule = new EntryPointNoLogicRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('ClassDeclaration detected');
  });

  it('ignores other files', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('other.ts')) return `function foo() {}`;
      return '';
    });
    const rule = new EntryPointNoLogicRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0); // Because it only checks main.ts by default
  });

  it('allows simple calls in main.ts', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (p.includes('main.ts')) return `import { run } from './app'; run();`;
      return '';
    });
    const rule = new EntryPointNoLogicRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
