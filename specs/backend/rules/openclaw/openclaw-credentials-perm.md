# OpenClaw Credentials Permission (600)

## 标识

- 规则ID：openclaw-credentials-perm
- 责任域：安全（security）

## 目的

- `~/.openclaw/credentials/**` 与 `~/.openclaw/auth-profiles.json` 等敏感文件权限需为 600。

## 行为

- 递归扫描敏感文件并校验 `stat.mode & 0o777 === 0o600`；Windows 环境默认跳过。

## 修复

- 自动修复：对不合规文件执行 `chmod 600`
