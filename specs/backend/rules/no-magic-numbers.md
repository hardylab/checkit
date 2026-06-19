# No Magic Numbers

## 标识

- 规则ID：no-magic-numbers
- 责任域：样式（styling）

## 目的

- 避免散落的“魔法数字”，提升可读性与可维护性。

## 范围

- `.ts/.tsx` 文件

## 行为

- 非允许列表中的字面量数值将被标记。
- 允许列表在范式中配置，例如 `[0, 1, -1, 2, 4, 8, 9, 42, 200]`。

## 示例

```ts
// 违规
if (retryCount > 3) {
  /* ... */
}

// 合规
const MAX_RETRY = 3;
if (retryCount > MAX_RETRY) {
  /* ... */
}
```

## 实施建议

- 为常量建立语义命名，并集中管理于常量模块或就近定义。
