# No Console Log

## 标识

- 规则ID：no-console-log
- 责任域：结构（structure）

## 目的

- 禁止在生产代码中使用 `console.log`，避免噪音输出与信息泄露。

## 范围

- 适用于 `packages/backend/src` 中除 `test` 目录外的 `.ts/.tsx` 文件。

## 行为

- 检测 `console.log` 调用（包含空格与格式差异）。
- 忽略 `test` 目录。

## 修复策略

- 自动修复：移除对应行或替换为项目统一日志接口（若存在）。
- 当前实现示例：删除匹配行并保留其余内容。

## 示例

```ts
// 违规
console.log('debug info');

// 合规
logger.debug('debug info'); // 若项目存在 logger
```

## 实施建议

- 统一使用结构化日志库（如 pino、winston），并控制日志级别与输出目的。
