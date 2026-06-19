import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Utf8EncodingRequiredRule } from '../utf8-encoding-required';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

vi.mock('fs');
vi.mock('path');

describe('utf8-encoding-required', () => {
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
    vi.spyOn(path, 'extname').mockImplementation((p: string) => {
      const m = p.match(/(\.[^.]+)$/);
      return m ? m[1] : '';
    });
  });

  it('reports BOM when allowBom=false and can fix', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['a.ts'],
    };
    const bomBuf = Buffer.from([0xef, 0xbb, 0xbf, 47, 47, 32, 97]);
    vi.spyOn(fs, 'readFileSync')
      .mockImplementationOnce(() => bomBuf)
      .mockImplementationOnce(() => bomBuf);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as unknown as void);
    const rule = new Utf8EncodingRequiredRule({ allowBom: false });
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].fixable).toBe(true);
    const fixed = rule.fix(issues[0]);
    expect(fixed).toBe(true);
  });

  it('reports non-utf8 replacement character and cannot fix', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['b.ts'],
    };
    const badStr = 'x\uFFFDy';
    const badBuf = Buffer.from(badStr, 'utf8');
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => badBuf);
    const rule = new Utf8EncodingRequiredRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].fixable).toBe(false);
  });

  it('passes when content is utf8 without bom', () => {
    const ctx: RuleContext = {
      ...ctxBase,
      files: ['c.ts'],
    };
    vi.spyOn(fs, 'readFileSync').mockImplementationOnce(() => Buffer.from('// ok', 'utf8'));
    const rule = new Utf8EncodingRequiredRule({});
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });
});
