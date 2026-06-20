---
name: file\gitignore-sensitive-required\gitignore-sensitive-required
type: rule
title: Require sensitive file patterns in .gitignore
tags: [security, hygiene]
severity: warn
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Ensures `.gitignore` includes patterns for sensitive or unnecessary files (`node_modules/`, `.env`, `.env.*`) to prevent accidental leakage or bloat in version control.

## Why use this rule

- Prevents secrets (`.env`, credentials) and bulky artifacts (`node_modules/`) from being committed to the repository.
- Catches missing gitignore configuration early, especially in new or migrated projects.
- Customizable via `options.patterns` — extend with project-specific sensitive patterns like `*.pem`, `secrets/`, or `credentials.json`.

## When it fires

```gitignore
# .gitignore — missing node_modules/ and .env
dist/
```

Fires with `error`: "缺少敏感/不必要文件的忽略配置：node_modules/, .env, .env.\*"

## How to fix

Add the missing patterns to `.gitignore`, or enable `autofix` to have them appended automatically (preserving existing content and EOL style).
