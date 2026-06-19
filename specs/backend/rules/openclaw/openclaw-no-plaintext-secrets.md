# OpenClaw No Plaintext Secrets

## 标识

- 规则ID：openclaw-no-plaintext-secrets
- 责任域：安全（security）

## 目的

- 禁止在 `openclaw.json` 中明文硬编码 `apiKey`，应引用环境变量或安全存储。

## 行为

- 正则检测：`"apiKey": "[A-Za-z0-9]{20,}"`，命中则给出 WARNING。
