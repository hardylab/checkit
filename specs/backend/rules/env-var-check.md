# Env Var Check

## 标识

- 规则ID：env-var-check
- 责任域：架构（architecture）

## 目的

- 检测对 `process.env` 的直接访问，并引导通过集中化配置或安全抽象访问环境变量。

## 范围

- `.ts/.tsx/.js/.jsx`（忽略 `test` 目录）

## 行为

- 捕获 `process.env.<KEY>` 访问；允许列表通过 `options.allow` 配置。

## 配置

- `allow?: string[]`：允许直接访问的变量列表（如 `['NODE_ENV']`）。

## 示例

```ts
// 违规
const k = process.env.API_KEY;

// 合规（集中管理）
const k = config.apiKey();
```

## 实施建议

- 建立配置读取层，对敏感信息进行取用与审计。
