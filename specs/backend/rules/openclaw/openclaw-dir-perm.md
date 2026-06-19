# OpenClaw Dir Permission (700)

## 标识

- 规则ID：openclaw-dir-perm
- 责任域：安全（security）

## 目的

- `~/.openclaw` 目录权限需为 700（drwx------），仅允许所有者读写执行。

## 行为

- POSIX 环境检查 `stat.mode & 0o777` 是否为 `0o700`；Windows 环境默认跳过。

## 修复

- 自动修复：`chmod 700 ~/.openclaw`
