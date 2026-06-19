/**
 * CheckIt Intent Engine
 *
 * 简化版 harness-life IntentEngine:
 * - emit(type, payload) → 返回 intent id,异步 dispatch
 * - dispatch(intentId) → 找所有 handler,顺序执行
 * - register(type, handler) → 注册 handler(可多个)
 *
 * 与 harness-life 差异:
 * - 不持久化(内存 only,V5 再加)
 * - 不检查 dependsOn DAG(简化,V5 再加)
 * - 无 retry / no attempts 限制(简化)
 */

import { randomUUID } from 'crypto';
import type {
  Intent,
  IntentStatus,
  IntentHandler,
  HandlerContext,
  RunState,
  RunOptions,
} from './types';

export interface EngineOptions {
  /** 同步模式(测试用):emit 后立即 dispatch,否则 async */
  sync?: boolean;
  /** 初始 state */
  initialState?: Partial<RunState>;
  /** 初始 options */
  options?: Partial<RunOptions>;
}

export class IntentEngine {
  private intents: Map<string, Intent> = new Map();
  private handlers: Map<string, IntentHandler[]> = new Map();
  private byType: Map<string, string[]> = new Map();
  private sync: boolean;
  private state: RunState;
  private options: RunOptions;

  constructor(opts: EngineOptions = {}) {
    this.sync = opts.sync ?? false;
    this.state = {
      activeIssues: new Map(),
      ignoredFingerprints: new Set(),
      allIntents: [],
      stats: { errors: 0, warnings: 0, infos: 0, ignored: 0 },
      ...(opts.initialState ?? {}),
    };
    this.options = {
      autofix: false,
      reporter: 'stylish',
      ...(opts.options ?? {}),
    };
  }

  /**
   * 注册 handler(同一 type 可注册多个,顺序执行)
   */
  register<T>(type: string, handler: IntentHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    (this.handlers.get(type) as IntentHandler<T>[]).push(handler as IntentHandler);
  }

  /**
   * 创建 intent
   *
   * 注意:无论 sync 还是 async 模式,emit 都不直接 dispatch。
   * sync 模式由测试代码手动调用 drain() 触发,async 模式同理。
   * 这样避免 handler 内部 emit 形成无限递归(因为 emit 会 dispatch,dispatch 会调 handler...)。
   */
  emit<T>(
    type: string,
    payload: T,
    options: { fingerprint?: string; dependsOn?: string[] } = {}
  ): string {
    const id = randomUUID();
    const intent: Intent<T> = {
      id,
      type,
      payload,
      status: 'pending',
      dependsOn: options.dependsOn ?? [],
      attempts: 0,
      createdAt: Date.now(),
      fingerprint: options.fingerprint,
    };
    this.intents.set(id, intent);
    this.state.allIntents.push(intent);

    if (!this.byType.has(type)) {
      this.byType.set(type, []);
    }
    this.byType.get(type)!.push(id);

    return id;
  }

  /**
   * 派发 intent:找所有 handler,顺序执行
   */
  async dispatch(intentId: string): Promise<void> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }
    if (intent.status === 'completed' || intent.status === 'failed') {
      return; // 幂等
    }
    intent.status = 'dispatched';
    intent.attempts++;

    const handlers = this.handlers.get(intent.type) ?? [];
    if (handlers.length === 0) {
      // 无 handler:警告但不抛错(允许未处理 Intent 存在)
      // V5 可改为强制要求 handler
      return;
    }

    const ctx = this.makeContext();

    for (const handler of handlers) {
      try {
        await handler(intent as Intent, ctx);
      } catch (e) {
        intent.status = 'failed';
        intent.error = (e as Error).message;
        throw e;
      }
    }

    intent.status = 'completed';
    intent.completedAt = Date.now();
  }

  /**
   * 同步模式:sync=true 时,需要调 drain() 等待所有 pending dispatch 完成
   */
  async drain(): Promise<void> {
    // 简化:drain 等于再 dispatch 一遍所有 pending
    const pending = Array.from(this.intents.values()).filter(
      (i) => i.status === 'pending'
    );
    for (const intent of pending) {
      await this.dispatch(intent.id);
    }
  }

  /** 查询 */
  getIntent(id: string): Intent | undefined {
    return this.intents.get(id);
  }

  getByType(type: string): Intent[] {
    const ids = this.byType.get(type) ?? [];
    return ids.map((id) => this.intents.get(id)!).filter(Boolean);
  }

  getAllIntents(): Intent[] {
    return Array.from(this.intents.values());
  }

  /** Run state */
  getState(): RunState {
    return this.state;
  }

  getOptions(): RunOptions {
    return this.options;
  }

  /** 生成 Handler Context(每个 dispatch 调用一次) */
  private makeContext(): HandlerContext {
    return {
      emit: <P>(type: string, payload: P, options?: { fingerprint?: string; dependsOn?: string[] }) =>
        this.emit(type, payload, options),
      getIntent: (id: string) => this.intents.get(id),
      getByType: (type: string) => this.getByType(type),
      ignoreIssue: (fp: string) => {
        this.state.ignoredFingerprints.add(fp);
      },
      isIgnored: (fp: string) => this.state.ignoredFingerprints.has(fp),
      state: this.state,
      options: this.options,
    };
  }
}

/**
 * 计算 issue fingerprint(用于 dedupe)
 * 同 (file, line, ruleId) = 同一 issue
 */
export function fingerprintOf(ruleId: string, issue: { file?: string; line?: number }): string {
  return `${ruleId}::${issue.file ?? '<project>'}::${issue.line ?? 0}`;
}
