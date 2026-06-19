# OpenClaw Security Audit

## 标识

- 规则ID：openclaw-security-audit
- 责任域：安全（security）

## 目的

- 提供自动修复入口：执行 `openclaw security audit --fix` 修复权限配置。

## 行为

- 检查阶段提示可修复；在修复阶段尝试调用 CLI。
