import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequireTsconfigOneWayReferencesRule } from '../require-tsconfig-one-way-references';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('require-tsconfig-one-way-references', () => {
  const ctxBase: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root',
    targetName: 'workspace',
    targetType: 'project',
    files: [],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(path, 'join').mockImplementation((...parts: string[]) => parts.join('/'));
    vi.spyOn(path, 'basename').mockImplementation((p: string) => p.split('/').pop() || p);
    vi.spyOn(path, 'normalize').mockImplementation((p: string) => p);
    vi.spyOn(path, 'dirname').mockImplementation((p: string) =>
      p.split('/').slice(0, -1).join('/')
    );
    vi.spyOn(path, 'resolve').mockImplementation((...parts: string[]) => parts.join('/'));
    vi.spyOn(path, 'relative').mockImplementation((from: string, to: string) => {
      const rel = to.startsWith(from)
        ? to.slice(from.length + (to[from.length] === '/' ? 1 : 0))
        : to;
      const parts = rel.split('/').filter((p) => p.length > 0);
      const stack: string[] = [];
      for (const p of parts) {
        if (p === '.') continue;
        if (p === '..') {
          if (stack.length) stack.pop();
        } else {
          stack.push(p);
        }
      }
      return stack.join('/');
    });
  });

  it('detects mutual references between two packages', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['packages/a/tsconfig.json', 'packages/b/tsconfig.json'],
    };
    vi.spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../b' }] }))
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../a' }] }));
    const rule = new RequireTsconfigOneWayReferencesRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].issue).toContain('循环依赖');
  });

  it('detects longer cycle across three packages', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['packages/a/tsconfig.json', 'packages/b/tsconfig.json', 'packages/c/tsconfig.json'],
    };
    vi.spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../b' }] }))
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../c' }] }))
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../a' }] }));
    const rule = new RequireTsconfigOneWayReferencesRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some((i) =>
        (i.issue || '').includes('packages/a -> packages/b -> packages/c -> packages/a')
      )
    ).toBe(true);
  });

  it('passes when references are acyclic', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['packages/a/tsconfig.json', 'packages/b/tsconfig.json'],
    };
    vi.spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => JSON.stringify({ references: [{ path: '../b' }] }))
      .mockImplementationOnce(() => JSON.stringify({ references: [] }));
    const rule = new RequireTsconfigOneWayReferencesRule({});
    const issues = rule.check(ctx);
    expect(issues.length).toBe(0);
  });
});
