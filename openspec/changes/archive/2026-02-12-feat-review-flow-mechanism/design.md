## 上下文

当前的 `ReviewRule` 执行机制是扁平化的，通过 `main.ts` 中的循环遍历 `activeParadigm.rules` 并实例化执行。为了支持 PDCA 等有序且有依赖关系的检查流程，我们需要引入 `flow` 概念。

## 目标 / 非目标

**目标：**

- 定义 `ReviewRule` 接口中的 `flow` 属性。
- 实现基于 `flow` 的规则分组和排序执行逻辑。
- 确保前序规则失败时，后续同 `flow` 规则不执行。
- 保持向后兼容性，无 `flow` 属性的规则按原逻辑执行（或视为默认 flow）。

**非目标：**

- 复杂的依赖图（DAG），目前仅支持简单的线性顺序 (`order`)。
- 跨 flow 的依赖关系。

## 决策

### 1. `flow` 属性定义

在 `ReviewRule` 接口中增加：

```typescript
interface ReviewRule {
  // ... existing fields
  flow?: {
    key: string; // flow 的唯一标识，如 "pdca"
    order: number; // 执行顺序，越小越先执行
  };
}
```

**理由**：简单直观，易于理解和实现。

### 2. 执行逻辑改造

在 `main.ts` 中：

1.  实例化所有启用的规则。
2.  将规则分为两类：
    - `standaloneRules`: 没有 `flow` 属性的规则。
    - `flowRules`: 有 `flow` 属性的规则，按 `key` 分组。
3.  首先执行 `standaloneRules`（或者与 flow 并行，但为了简单起见，可以先执行 standalone，或者将 standalone 视为一种特殊的 flow）。
    - _决策_：为了简化日志和逻辑，先执行 standalone 规则，再按 flow 分组执行。
    - 或者：将所有规则视为一个集合，只是 flow 规则有特殊的跳过逻辑。
    - _修正决策_：为了清晰，将 flow 视为一种聚合。
      - 先执行所有无 flow 的规则。
      - 然后遍历每个 flow group：
        - 对组内规则按 `order` 排序。
        - 依次执行。
        - 如果某规则产生 Issue（Level >= Error? 还是只要有 Issue? 用户说“验收通过”，通常意味着没有 Issue，或者没有 Error。考虑到 CheckIt 的严格性，通常是 Clean。但 Warning 是否阻断？核心记忆：所有 warning 和 error 必须修复。所以只要有 Issue 就阻断）。
        - 一旦阻断，记录跳过日志，停止该 flow 后续规则。

### 3. 并行与串行

目前 `main.ts` 是单线程同步/异步执行（`await glob` 后内存中处理）。规则检查本身通常是同步的（`check(context)`），但如果有异步规则，需要 `await`。目前 `check` 是同步的。
`flow` 内部必须串行。不同 `flow` 之间可以并行，但 JS 单线程模型下，顺序执行即可。

## 风险 / 权衡

**风险**：

- 如果 `order` 重复怎么办？
  - _策略_：`order` 相同的规则，执行顺序不确定（依赖于遍历顺序），但它们之间互不阻塞（除非它们都失败了？不，同 order 视为同一批次？不，简单起见，同 order 的规则，其中一个失败，后续 order 更大的规则不执行。同 order 的规则都执行完，再检查是否进入下一 order）。
  - _细化策略_：Flow 执行按 `order` 递增。
    - Step 1: 找出当前最小 `order` 的所有规则。
    - Step 2: 执行这些规则。
    - Step 3: 如果其中任何一个规则产生阻断性 Issue，则标记 Flow 失败，不再执行更高 `order` 的规则。
    - Step 4: 继续下一 `order`。

**权衡**：

- 仅支持简单的线性流，不支持复杂分支，但这对于目前的 PDCA 等场景足够了。

## 迁移计划

- 无需迁移，新属性可选。
