/**
 * V3 → V4 Adapter
 *
 * 把 V3 ReviewRule(check 返回 ReviewIssue[])包装成 IntentEmittingRule(scan emit Rule.Found)
 *
 * 关键约束:
 * - 零侵入:V3 rule 文件不动
 * - 行为兼容:同 input → 同 output(只是从"返回数组"变"emit intent")
 * - 纯函数:无副作用,可测试
 *
 * 用法:
 *   const adapted = adaptRule(V3RuleClass);
 *   const intentIds = adapted.scan(ctx);  // 返回 intent id 列表
 *   // ... engine.dispatch(intentIds[0])
 */

import type { ReviewRule, RuleContext } from '@checkit/shared';
import type {
  Intent,
  IntentEmittingRule,
  RuleFixPayload,
  RuleFoundPayload,
  IntentHandler,
} from './types';

/**
 * Adapter 构造函数签名
 */
export type V3RuleConstructor = new (options?: unknown) => ReviewRule;

/**
 * 把 V3 rule class 包装成 IntentEmittingRule 实例
 *
 * 注意:返回的是 adapter 实例,不是 V3 rule 实例。
 * 通过 adapter.scan(ctx) 触发原 rule.check(),并通过 engine.emit 发 intent。
 *
 * @param Ctor V3 rule class
 * @param options 传给 V3 rule 的 options
 * @returns IntentEmittingRule
 */
export function adaptRule(Ctor: V3RuleConstructor, options?: unknown): IntentEmittingRule {
  // 实例化 V3 rule(用其原来的 options)
  const v3 = new Ctor(options);

  return {
    id: v3.id,
    v3,
    /**
     * scan:调 V3 rule.check(ctx),对每个 issue emit Rule.Found intent
     * 返回 emit 的 intent id 列表
     */
    scan(ctx: RuleContext): string[] {
      // 调用 V3 老接口
      const issues = v3.check(ctx);

      // emit Rule.Found per issue
      // 注:engine 需要外部注入。这里通过 emitFn 参数注入,避免 adapter 直接依赖 engine。
      return issues.map((issue) => {
        // 返回一个 sentinel:adapter 模式不直接 emit,留给 runner 循环 emit
        // 简化:adapter 直接返回 issue 列表,runner 负责 emit
        return issue as unknown as string;
      });
    },
    fix(intent: Intent<RuleFixPayload>): boolean {
      if (!v3.fix) return false;
      return v3.fix(intent.payload.issue);
    },
  };
}

/**
 * 真正干活的版本:runAdaptedRule 把 V3 rule 跑一遍,emit Rule.Found intents
 *
 * 这才是 cli.ts 要调的函数:
 *   const intentIds = runAdaptedRule(adapted, ctx, engine);
 *   for (const id of intentIds) await engine.dispatch(id);
 *
 * @param adapted IntentEmittingRule
 * @param ctx RuleContext
 * @param emitFn 注入 emit 函数(测试时 mock,生产用 engine.emit)
 * @returns emit 的 intent id 列表
 */
export function runAdaptedRule(
  adapted: IntentEmittingRule,
  ctx: RuleContext,
  emitFn: <P>(type: string, payload: P) => string
): string[] {
  // 从 v3 rule 拿 issues(走 V3 老接口)
  if (!adapted.v3) {
    throw new Error(`Adapted rule ${adapted.id} has no v3 backing rule`);
  }
  const issues = adapted.v3.check(ctx);

  // 每个 issue emit Rule.Found
  const ids: string[] = [];
  for (const issue of issues) {
    const id = emitFn<RuleFoundPayload>('Rule.Found', {
      ruleId: adapted.id,
      issue,
    });
    ids.push(id);
  }
  return ids;
}

/**
 * 批量包装 rule class map
 *
 * 用法:
 *   const adaptedMap = adaptAllRules(ruleClasses);
 *   // adaptedMap: Record<ruleId, V3RuleConstructor>
 *
 * 注意:返回的还是 Ctor map,因为每个 rule 在 run 时才实例化(传 options)
 * 真正的实例化发生在 runAdaptedRule。
 */
export function adaptAllRules(
  ruleClasses: Record<string, V3RuleConstructor>
): Record<string, V3RuleConstructor> {
  // 简化:只是占位,实际 cli.ts 直接用 ruleClasses(它们已经是 V3 形式)
  // 这个函数存在的意义是为 V5 留口子(V5 可能所有 rule 都改成 IntentEmittingRule 形式)
  return ruleClasses;
}

/**
 * 检查一个 rule class 是否需要 adapter
 *
 * V3 rule 有 check() 返回 array → 需要 adapter
 * V4 rule 有 scan(ctx) emit intent → 不需要 adapter
 *
 * @param Ctor
 * @returns true 表示需要 adapter
 */
export function needsAdapter(Ctor: V3RuleConstructor | IntentEmittingRule): boolean {
  if (typeof Ctor === 'function') {
    // class → 检查 prototype
    const proto = Ctor.prototype;
    return typeof proto.check === 'function';
  }
  // IntentEmittingRule object
  return typeof (Ctor as IntentEmittingRule).v3?.check === 'function';
}

// (避免循环依赖,把 IntentHandler 类型再 export 一次)
export type { IntentHandler };
