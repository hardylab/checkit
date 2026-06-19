# Require Index Export

## 标识

- 规则ID：require-index-export
- 责任域：结构（structure）

## 目的

- 要求模块根目录存在 `index.ts` 并统一导出公共 API，提升可发现性与稳定入口。

## 行为

- 检查模块是否提供 `index.ts`，并包含导出语句。

## 示例

```ts
// 合规
// packages/backend/src/rules/index.ts
export * from './ts';
export * from './file';
```

## 实施建议

- 每个规则分组目录应维护一个 `index.ts` 统一出口。
