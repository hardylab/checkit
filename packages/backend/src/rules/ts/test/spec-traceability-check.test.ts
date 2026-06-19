import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecTraceabilityCheckRule } from '../spec-traceability-check';
import type { RuleContext } from '@checkit/shared';
import fs from 'fs';

vi.mock('fs');

describe('spec-traceability-check', () => {
  const ctx: RuleContext = {
    cwd: '/cwd',
    projectRoot: '/root',
    targetPath: '/root/target',
    targetName: 'proj',
    targetType: 'project',
    files: ['users.service.ts'],
    autoFix: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    // Mock statSync to return recent time by default
    vi.spyOn(fs, 'statSync').mockReturnValue({
      mtimeMs: Date.now(),
      birthtimeMs: Date.now(),
    } as any);
    // Mock path.join/resolve for simple behavior in test
    // vi.spyOn(path, 'join').mockImplementation((...parts) => parts.join('/'));
    // vi.spyOn(path, 'resolve').mockImplementation((...parts) => parts.join('/'));
    // Actually, node's path module works fine in tests usually, unless we want strict posix paths on windows.
    // The previous test mocked path.join. I'll stick to real path if possible, or mock consistent with my implementation.
    // My implementation uses path.join(context.projectRoot, link) which is '/root' + '/specs/...' -> '/root/specs/...'
  });

  it('reports missing spec file for recent file', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) {
        return '// spec:[spec](/specs/missing.md)\nexport class UserService {}';
      }
      return '';
    });
    // Mock existsSync: users.service.ts exists, but spec doesn't
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) return true;
      if (typeof p === 'string' && p.includes('missing.md')) return false;
      return true;
    });

    const rule = new SpecTraceabilityCheckRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('关联的 spec 文件不存在');
  });

  it('reports short spec file for recent file', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) {
        return '// spec:[spec](/specs/short.md)\nexport class UserService {}';
      }
      if (typeof p === 'string' && p.includes('short.md')) {
        return '# Title'; // < 50 chars
      }
      return '';
    });

    const rule = new SpecTraceabilityCheckRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('关联的 spec 文件内容过少');
  });

  it('passes for valid spec file for recent file', () => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) {
        return '// spec:[spec](/specs/valid.md)\nexport class UserService {}';
      }
      if (typeof p === 'string' && p.includes('valid.md')) {
        return '# Title\n' + 'A'.repeat(60); // > 50 chars
      }
      return '';
    });

    const rule = new SpecTraceabilityCheckRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });

  it('ignores spec checks for old files', () => {
    // Set time to old
    vi.spyOn(fs, 'statSync').mockReturnValue({
      mtimeMs: Date.now() - 120 * 60 * 1000, // 2 hours ago
      birthtimeMs: Date.now() - 120 * 60 * 1000,
    } as any);

    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) {
        return '// spec:[spec](/specs/missing.md)\nexport class UserService {}';
      }
      return ''; // missing spec content would fail if checked
    });
    // Mock spec missing
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.endsWith('users.service.ts')) return true;
      if (typeof p === 'string' && p.includes('missing.md')) return false;
      return true;
    });

    const rule = new SpecTraceabilityCheckRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(0);
  });

  it('reports missing spec comment (existing logic)', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('export class UserService {}');
    const rule = new SpecTraceabilityCheckRule();
    const issues = rule.check(ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].issue).toContain('缺少规范追踪注释');
  });
});
