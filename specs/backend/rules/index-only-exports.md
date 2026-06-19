# Index Only Exports

## 标识

- 规则ID：index-only-exports
- 责任域：结构（structure）

## 目的

- 约束 `index.ts` 仅用于统一导出，避免在聚合入口编写实现逻辑。

## 行为

- 允许：`export ...` 语句与注释行
- 禁止：函数、对象、类等实现代码

## 示例

```ts
// 合规（index.ts）
export * from './foo';
export { bar } from './bar';

// 违规（index.ts）
export * from './foo';
const x = 1; // 不允许
```

## 实施建议

- 在子模块中实现，在 `index.ts` 进行聚合导出。
