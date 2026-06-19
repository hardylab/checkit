import { describe, it, expect } from 'vitest';
import { adaptRule, runAdaptedRule, needsAdapter } from './adapter';
import { IntentEngine } from './engine';
import { dedupeHandler } from './handlers/dedupe';
import { reportHandler } from './handlers/report';
import type { ReviewIssue, RuleContext } from '@checkit/shared';

// ─────────────── V3 测试用 rule ───────────────

/** V3 风格 rule:check 返回 ReviewIssue[] */
class MockV3Rule {
  static id = 'mock-v3';
  id = MockV3Rule.id;
  constructor(_: unknown) {}
  check(ctx: RuleContext): ReviewIssue[] {
    return [
      {
        type: 'structure',
        module: ctx.targetName,
        file: ctx.files[0] || 'src/x.ts',
        line: 1,
        issue: `found issue in ${ctx.files[0]}`,
        level: 'warning',
        fixable: false,
      },
    ];
  }
  fix(issue: ReviewIssue): boolean {
    return true;
  }
}

/** V3 rule 抛错 */
class ThrowingRule {
  static id = 'throwing';
  id = ThrowingRule.id;
  constructor(_: unknown) {}
  check(_: RuleContext): ReviewIssue[] {
    throw new Error('rule boom');
  }
}

/** V3 rule 返回空(无 issue) */
class EmptyRule {
  static id = 'empty';
  id = EmptyRule.id;
  constructor(_: unknown) {}
  check(_: RuleContext): ReviewIssue[] {
    return [];
  }
}

/** V3 rule 返回多个 issue */
class MultiIssueRule {
  static id = 'multi';
  id = MultiIssueRule.id;
  constructor(_: unknown) {}
  check(_: RuleContext): ReviewIssue[] {
    return [
      { type: 'structure', module: 'p', file: 'a.ts', line: 1, issue: 'i1', level: 'warning', fixable: false },
      { type: 'structure', module: 'p', file: 'a.ts', line: 2, issue: 'i2', level: 'warning', fixable: false },
      { type: 'structure', module: 'p', file: 'b.ts', line: 1, issue: 'i3', level: 'error', fixable: false },
    ];
  }
}

const mockCtx: RuleContext = {
  cwd: '/d/proj',
  projectRoot: '/d/proj',
  targetPath: '/d/proj',
  targetName: 'proj',
  targetType: 'project',
  files: ['src/foo.ts'],
  autoFix: false,
};

// ─────────────── tests ───────────────

describe('adaptRule', () => {
  it('包装 V3 rule → IntentEmittingRule,保留 id 和 v3 引用', () => {
    const adapted = adaptRule(MockV3Rule);
    expect(adapted.id).toBe('mock-v3');
    expect(adapted.v3).toBeInstanceOf(MockV3Rule);
  });

  it('options 传递给 V3 构造函数', () => {
    let captured: unknown = undefined;
    class CapturingRule {
      id = 'capturing';
      constructor(opts: unknown) {
        captured = opts;
      }
      check(): ReviewIssue[] { return []; }
    }
    adaptRule(CapturingRule, { custom: 'value' });
    expect(captured).toEqual({ custom: 'value' });
  });
});

describe('runAdaptedRule', () => {
  it('V3 rule 跑一遍,每个 issue emit Rule.Found', () => {
    const adapted = adaptRule(MultiIssueRule);
    const emitted: any[] = [];
    const emitFn = (type: string, payload: any) => {
      const id = `mock-${emitted.length}`;
      emitted.push({ id, type, payload });
      return id;
    };

    const ids = runAdaptedRule(adapted, mockCtx, emitFn);
    expect(ids).toHaveLength(3);
    expect(emitted).toHaveLength(3);
    expect(emitted.every((e) => e.type === 'Rule.Found')).toBe(true);
    expect(emitted[0].payload).toMatchObject({
      ruleId: 'multi',
      issue: { file: 'a.ts', line: 1, issue: 'i1' },
    });
  });

  it('空 issue 列表 → 返回空 ids', () => {
    const adapted = adaptRule(EmptyRule);
    const ids = runAdaptedRule(adapted, mockCtx, () => 'x');
    expect(ids).toHaveLength(0);
  });

  it('V3 rule 抛错 → 透传(不吞)', () => {
    const adapted = adaptRule(ThrowingRule);
    expect(() => runAdaptedRule(adapted, mockCtx, () => 'x')).toThrow('rule boom');
  });

  it('end-to-end:adapter + engine + dedupe + report', async () => {
    // 完整闭环
    const engine = new IntentEngine({
      sync: true,
      options: { reporter: 'stylish', autofix: false },
    });
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Report', reportHandler);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const adapted = adaptRule(MockV3Rule);
      const ids = runAdaptedRule(adapted, mockCtx, (t, p) => engine.emit(t, p));
      expect(ids).toHaveLength(1);

      await engine.drain();

      // 触发 report
      engine.emit('Rule.Report', { issues: [], errors: 0, warnings: 1 });
      await engine.drain();

      const out = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
      expect(out).toContain('[WARNING]');
      expect(out).toContain('found issue in src/foo.ts');
      expect(engine.getState().lastExitCode).toBe(0);
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('multiple rules 通过 adapter → dedupe 合并', async () => {
    const engine = new IntentEngine({
      sync: true,
      options: { reporter: 'silent', autofix: false },
    });
    engine.register('Rule.Found', dedupeHandler);

    // 跑 2 次同一 rule(same (file,line,ruleId))
    const adapted = adaptRule(MockV3Rule);
    const ctx1 = { ...mockCtx, files: ['src/foo.ts'] };
    const ctx2 = { ...mockCtx, files: ['src/foo.ts'] };
    runAdaptedRule(adapted, ctx1, (t, p) => engine.emit(t, p));
    runAdaptedRule(adapted, ctx2, (t, p) => engine.emit(t, p));
    await engine.drain();

    expect(engine.getState().activeIssues.size).toBe(1); // dedupe 合并
  });
});

describe('needsAdapter', () => {
  it('class with check() → true', () => {
    expect(needsAdapter(MockV3Rule)).toBe(true);
  });

  it('object without v3 → false', () => {
    const fake = { id: 'x', scan: () => [] };
    expect(needsAdapter(fake as any)).toBe(false);
  });

  it('IntentEmittingRule with v3 → true(有 v3 = 需要 adapter)', () => {
    const adapted = adaptRule(MockV3Rule);
    expect(needsAdapter(adapted)).toBe(true);
  });
});

// vi mock for stdout
import { vi } from 'vitest';
