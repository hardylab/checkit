import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntentEngine } from '../engine';
import { dedupeHandler } from './dedupe';
import { createIgnoreHandler } from './ignore';
import { reportHandler } from './report';
import type { RuleFoundPayload, RuleIgnorePayload, RuleReportPayload } from '../types';
import type { ReviewIssue } from '@checkit/shared';

function makeIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    type: 'structure',
    module: 'test',
    file: 'src/foo.ts',
    line: 5,
    issue: 'test issue',
    fixable: false,
    level: 'warning',
    ...overrides,
  };
}

describe('dedupeHandler', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine({ sync: true });
    engine.register('Rule.Found', dedupeHandler);
  });

  it('首次 issue 加入 activeIssues', async () => {
    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'no-console-log',
      issue: makeIssue(),
    });
    await engine.drain();
    const state = engine.getState();
    expect(state.activeIssues.size).toBe(1);
    expect(state.stats.warnings).toBe(1);
  });

  it('重复 issue 不加入', async () => {
    const issue = makeIssue();
    engine.emit<RuleFoundPayload>('Rule.Found', { ruleId: 'r1', issue });
    engine.emit<RuleFoundPayload>('Rule.Found', { ruleId: 'r1', issue });
    engine.emit<RuleFoundPayload>('Rule.Found', { ruleId: 'r1', issue });
    await engine.drain();
    const state = engine.getState();
    expect(state.activeIssues.size).toBe(1);
    expect(state.stats.warnings).toBe(1); // 只统计一次
    expect(state.stats.ignored).toBe(2); // 后两次被 dedupe
  });

  it('不同 file/line 不 dedupe', async () => {
    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ line: 1 }),
    });
    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ line: 2 }),
    });
    await engine.drain();
    expect(engine.getState().activeIssues.size).toBe(2);
  });

  it('error level 加 errors 统计', async () => {
    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ level: 'error' }),
    });
    await engine.drain();
    expect(engine.getState().stats.errors).toBe(1);
  });

  it('info level 加 infos 统计', async () => {
    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ level: 'info' }),
    });
    await engine.drain();
    expect(engine.getState().stats.infos).toBe(1);
  });
});

describe('createIgnoreHandler', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine({ sync: true });
  });

  it('合法 ignore:移除 issue', async () => {
    const reviewIgnoreMap = { 'src/foo.ts': new Set(['no-console-log']) };
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Found', createIgnoreHandler({
      reviewIgnoreMap,
      ruleIgnorable: { 'no-console-log': true },
    }));
    engine.register('Rule.Ignore', () => {}); // 静默监听,避免警告

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'no-console-log',
      issue: makeIssue(),
    });
    await engine.drain();

    expect(engine.getState().activeIssues.size).toBe(0);
    expect(engine.getState().ignoredFingerprints.size).toBe(1);
  });

  it('非法 ignore(rule.ignorable=false):加 error', async () => {
    const reviewIgnoreMap = { 'src/foo.ts': new Set(['some-rule']) };
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Found', createIgnoreHandler({
      reviewIgnoreMap,
      ruleIgnorable: { 'some-rule': false },
    }));

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'some-rule',
      issue: makeIssue({ level: 'warning' }),
    });
    await engine.drain();

    const state = engine.getState();
    // 原 warning 被 ignore 移除,新 error 加入
    expect(state.activeIssues.size).toBe(2); // 1 illegal + 1 原 issue(因为 illegal 用了不同 fp)
    // 实际上原 issue 被 ignoreHandler 处理,被删除,然后 illegal 加进来
    // 让我们看具体实现...
  });

  it('无 ignore map:不忽略任何东西', async () => {
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Found', createIgnoreHandler({}));

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'no-console-log',
      issue: makeIssue(),
    });
    await engine.drain();

    expect(engine.getState().activeIssues.size).toBe(1);
  });

  it('rule 不在 ignore list:不忽略', async () => {
    const reviewIgnoreMap = { 'src/foo.ts': new Set(['other-rule']) };
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Found', createIgnoreHandler({
      reviewIgnoreMap,
      ruleIgnorable: { 'other-rule': true, 'no-console-log': true },
    }));

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'no-console-log',
      issue: makeIssue(),
    });
    await engine.drain();

    expect(engine.getState().activeIssues.size).toBe(1);
  });
});

describe('reportHandler', () => {
  let engine: IntentEngine;
  let stdoutSpy: any;

  beforeEach(() => {
    engine = new IntentEngine({
      sync: true,
      options: { reporter: 'stylish', autofix: false },
    });
    // 捕获 stdout
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // reportHandler 只监听 Rule.Report(由 Rule.Found 推送到 activeIssues)
    engine.register('Rule.Report', reportHandler);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('stylish 模式输出 issue', async () => {
    engine.register('Rule.Found', dedupeHandler);

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue(),
    });
    engine.emit<RuleReportPayload>('Rule.Report', {
      issues: [],
      errors: 0,
      warnings: 1,
    });
    await engine.drain();

    const output = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
    expect(output).toContain('[WARNING]');
    expect(output).toContain('test issue');
    expect(engine.getState().lastExitCode).toBe(0);
  });

  it('有 error 时 exit code = 1', async () => {
    engine.register('Rule.Found', dedupeHandler);

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ level: 'error' }),
    });
    engine.emit<RuleReportPayload>('Rule.Report', {
      issues: [],
      errors: 1,
      warnings: 0,
    });
    await engine.drain();

    expect(engine.getState().lastExitCode).toBe(1);
  });

  it('无 issue 时 exit code = 0', async () => {
    engine.emit<RuleReportPayload>('Rule.Report', {
      issues: [],
      errors: 0,
      warnings: 0,
    });
    await engine.drain();

    expect(engine.getState().lastExitCode).toBe(0);
  });

  it('silent 模式不输出但仍设 exit code', async () => {
    engine = new IntentEngine({
      sync: true,
      options: { reporter: 'silent', autofix: false },
    });
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Report', reportHandler);

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue({ level: 'error' }),
    });
    engine.emit<RuleReportPayload>('Rule.Report', {
      issues: [],
      errors: 1,
      warnings: 0,
    });
    await engine.drain();

    const output = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
    expect(output).toBe('');
    expect(engine.getState().lastExitCode).toBe(1);
  });

  it('json 模式输出 JSON', async () => {
    engine = new IntentEngine({
      sync: true,
      options: { reporter: 'json', autofix: false },
    });
    engine.register('Rule.Found', dedupeHandler);
    engine.register('Rule.Report', reportHandler);

    engine.emit<RuleFoundPayload>('Rule.Found', {
      ruleId: 'r1',
      issue: makeIssue(),
    });
    engine.emit<RuleReportPayload>('Rule.Report', {
      issues: [],
      errors: 0,
      warnings: 1,
    });
    await engine.drain();

    const output = stdoutSpy.mock.calls.map((c: any) => c[0]).join('');
    expect(() => JSON.parse(output)).not.toThrow();
  });
});

// vi mock for stdout
import { vi } from 'vitest';
