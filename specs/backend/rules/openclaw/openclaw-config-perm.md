# OpenClaw Config Permission (600)

## 标识

- 规则ID：openclaw-config-perm
- 责任域：安全（security）

## 目的

- `~/.openclaw/openclaw.json` 权限需为 600（-rw-------），仅允许所有者读写。

## 行为

- POSIX 环境检查 `stat.mode & 0o777` 是否为 `0o600`；Windows 环境默认跳过。

## 修复

- 自动修复：`chmod 600 ~/.openclaw/openclaw.json`
