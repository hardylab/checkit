---
name: git-ignore-required
title: Git Ignore Required
tags: [file, security, hygiene, gitignore]
severity: warn
status: stable
---

# git-ignore-required

## TL;DR

确保每个项目根目录都存在 `.gitignore`,并且包含**通用卫生**必需的 ignore 模式(`node_modules/`、`dist/`、`.env`、`*.log`、IDE 临时文件等)。

跟 [`gitignore-sensitive-required`](../gitignore-sensitive-required/README.md) 的区别:

| 规则 | 关注点 | 典型模式 |
|---|---|---|
| `git-ignore-required` | 通用卫生(任何项目都该有) | `node_modules/`, `dist/`, `.env`, `*.log`, `.DS_Store` |
| `gitignore-sensitive-required` | 敏感信息(易泄密) | `*.pem`, `*.key`, `secrets/`, `credentials.json` |

`git-ignore-required` 是"仓库基本卫生"—— 防止误把构建产物、依赖、本地配置、IDE 临时文件提交进仓库。

---

## 触发条件

1. **ERROR**:仓库根目录**没有** `.gitignore` 文件。
2. **WARN**:`.gitignore` 存在,但**缺少**必填模式。

---

## 默认必填模式

```gitignore
node_modules/
dist/
build/
.next/
.turbo/
coverage/
.env
.env.local
.env.*.local
*.log
.DS_Store
Thumbs.db
.vscode/
.idea/
*.swp
*.swo
*~
```

可通过 `options.patterns` 追加自定义模式,默认模式始终包含。

---

## 配置

```jsonc
{
  "rules": {
    "git-ignore-required": {
      "level": "warn",          // "off" | "warn" | "error"
      "type": "security",
      "options": {
        "patterns": [
          "vendor/",
          "tmp/"
        ]
      },
      "autofix": true
    }
  }
}
```

### 选项

| 选项 | 类型 | 说明 |
|---|---|---|
| `patterns` | `string[]` | 追加的自定义必填模式(并入默认列表,去重) |

---

## 使用示例

### ✅ 正确 — `.gitignore` 完整

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store
```

→ 无 issue。

### ❌ 缺失整个 `.gitignore`

```text
$ ls
src/  package.json
```

→ 触发 **error**:
> Missing .gitignore file — every project must have one

### ⚠️ `.gitignore` 存在但缺模式

```gitignore
# .gitignore
dist/
```

→ 触发 **warn**:
> Missing patterns in .gitignore: node_modules/, .env, *.log, .DS_Store

---

## 自动修复

支持 `autofix`(`fixable: true`):

- **整体缺失** → 在目标路径直接写入全部默认模式。
- **部分缺失** → 在已有 `.gitignore` 末尾追加缺失项(保留原内容,自动保留 EOL 风格)。

修复失败时(如权限不足)返回 `false`,不抛错。

---

## 相关规则

- [`gitignore-sensitive-required`](../gitignore-sensitive-required/README.md) — 检查敏感信息(密钥、证书)是否被忽略
- [`git-no-large-files`](../git-no-large-files/README.md) — 阻止大文件进仓库
- [`git-no-secrets-in-history`](../git-no-secrets-in-history/README.md) — 检查历史里有没有误提交的密钥