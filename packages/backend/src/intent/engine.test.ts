import { describe, it, expect, beforeEach } from 'vitest';
import { IntentEngine, fingerprintOf } from './engine';
import type { Intent } from './types';

describe('IntentEngine', () => {
  let engine: IntentEngine;

  beforeEach(() => {
    engine = new IntentEngine({ sync: true });
  });

  describe('emit + dispatch', () => {
    it('emit 创建 pending intent', () => {
      const id = engine.emit('Test.Event', { foo: 'bar' });
      const intent = engine.getIntent(id);
      expect(intent).toBeDefined();
      expect(intent?.type).toBe('Test.Event');
      expect(intent?.status).toBe('pending');
      expect(intent?.payload).toEqual({ foo: 'bar' });
    });

    it('sync 模式下需要显式 drain 触发 dispatch', async () => {
      engine.register('Test.Event', () => {});
      const id = engine.emit('Test.Event', {});
      // 未 drain 前,status 是 pending
      expect(engine.getIntent(id)?.status).toBe('pending');
      await engine.drain();
      expect(engine.getIntent(id)?.status).toBe('completed');
    });

    it('handler 执行后 intent 状态变 completed', async () => {
      engine.register('Test.Event', (intent) => {
        intent.result = 'handled';
      });
      const id = engine.emit('Test.Event', { x: 1 });
      await engine.drain();
      const intent = engine.getIntent(id);
      expect(intent?.status).toBe('completed');
      expect(intent?.result).toBe('handled');
    });

    it('多个 handler 按注册顺序执行', async () => {
      const order: string[] = [];
      engine.register('Test.Event', () => order.push('h1'));
      engine.register('Test.Event', () => order.push('h2'));
      engine.register('Test.Event', () => order.push('h3'));
      engine.emit('Test.Event', {});
      await engine.drain();
      expect(order).toEqual(['h1', 'h2', 'h3']);
    });

    it('handler 抛错时 intent 状态变 failed', async () => {
      engine.register('Test.Event', () => {
        throw new Error('handler boom');
      });
      const id = engine.emit('Test.Event', {});
      await expect(engine.dispatch(id)).rejects.toThrow('handler boom');
      const intent = engine.getIntent(id);
      expect(intent?.status).toBe('failed');
      expect(intent?.error).toBe('handler boom');
    });

    it('dispatch 是幂等的(状态 completed 后再次 dispatch 无效)', async () => {
      engine.register('Test.Event', () => {});
      const id = engine.emit('Test.Event', {});
      await engine.dispatch(id);
      await engine.dispatch(id); // 第二次应直接返回
      const intent = engine.getIntent(id);
      expect(intent?.status).toBe('completed');
      expect(intent?.attempts).toBe(1); // 只 dispatch 一次
    });
  });

  describe('查询', () => {
    it('getByType 按 type 返回所有 intent', async () => {
      engine.emit('A', { n: 1 });
      engine.emit('B', { n: 2 });
      engine.emit('A', { n: 3 });
      const aIntents = engine.getByType('A');
      expect(aIntents).toHaveLength(2);
      expect(aIntents.map((i) => i.payload)).toEqual([{ n: 1 }, { n: 3 }]);
    });

    it('getAllIntents 返回所有', async () => {
      engine.emit('A', {});
      engine.emit('B', {});
      engine.emit('C', {});
      expect(engine.getAllIntents()).toHaveLength(3);
    });
  });

  describe('HandlerContext', () => {
    it('emit 新 Intent 互相可见', async () => {
      const seen: Intent[] = [];
      engine.register('Outer', (intent, ctx) => {
        const innerId = ctx.emit('Inner', { from: 'outer' });
        seen.push(ctx.getIntent(innerId)!);
      });
      engine.register('Inner', () => {});
      engine.emit('Outer', {});
      await engine.drain();
      expect(seen).toHaveLength(1);
      expect(seen[0].type).toBe('Inner');
    });

    it('ignoreIssue / isIgnored 跨 intent 共享', async () => {
      engine.register('Set', (intent, ctx) => {
        ctx.ignoreIssue('fp-1');
      });
      engine.register('Check', (intent, ctx) => {
        expect(ctx.isIgnored('fp-1')).toBe(true);
      });
      engine.emit('Set', {});
      engine.emit('Check', {});
      await engine.drain();
    });

    it('state 共享(同一 run 内)', async () => {
      engine.register('Add', (intent, ctx) => {
        (ctx.state as any).counter = ((ctx.state as any).counter ?? 0) + 1;
      });
      engine.emit('Add', {});
      engine.emit('Add', {});
      engine.emit('Add', {});
      await engine.drain();
      expect((engine.getState() as any).counter).toBe(3);
    });
  });
});

describe('fingerprintOf', () => {
  it('同 (ruleId, file, line) 相同 fingerprint', () => {
    const fp1 = fingerprintOf('no-console-log', { file: 'src/foo.ts', line: 5 });
    const fp2 = fingerprintOf('no-console-log', { file: 'src/foo.ts', line: 5 });
    expect(fp1).toBe(fp2);
  });

  it('不同 file 不同 fingerprint', () => {
    const fp1 = fingerprintOf('r', { file: 'a.ts', line: 1 });
    const fp2 = fingerprintOf('r', { file: 'b.ts', line: 1 });
    expect(fp1).not.toBe(fp2);
  });

  it('无 file 时用 <project> 占位', () => {
    const fp = fingerprintOf('r', {});
    expect(fp).toContain('<project>');
  });
});
