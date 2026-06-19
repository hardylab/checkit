# OpenClaw CLI Available

## 标识

- 规则ID：openclaw-cli-available
- 责任域：环境（environment）

## 目的

- 检查是否已将 `openclaw` 添加到环境变量 PATH，命令行可直接调用。

## 行为

- 执行 `openclaw --version`，失败则报 ERROR。
