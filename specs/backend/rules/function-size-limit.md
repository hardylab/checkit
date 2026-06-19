# Function Size Limit

## 标识

- 规则ID：function-size-limit
- 责任域：架构（architecture）

## 目的

- 限制单个函数的代码行数，鼓励职责分离与可测试性。

## 范围

- `.ts/.tsx/.js/.jsx` 文件（忽略 `test` 目录）

## 行为

- 通过 `{`/`}` 深度追踪函数块，计算函数大小。
- 默认最大行数可在范式配置中设置（例如 200）。

## 配置

- `maxLines?: number`：最大允许行数。

## 示例

```ts
// 违规（超过阈值）
function big() {
  // too many lines...
}
```

## 实施建议

- 超出阈值时，优先拆分为私有辅助函数或提取业务服务层。
