---
name: file\filename-naming-rule\filename-naming-rule
type: rule
title: Enforce consistent filename naming conventions per directory and extension
tags: [naming, style]
severity: warn
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Ensures filenames follow project-defined naming styles (camelCase, PascalCase, snake_case, kebab-case, or custom regex) configured per directory and file extension.

## Why use this rule

- Prevents inconsistent filenames that reduce readability and make the codebase harder to navigate.
- Allows fine-grained per-directory configuration so different areas of the project can use different conventions.
- Supports an optional `matchDirectory` mode that requires a file's basename to match its parent directory name (or be `index`).

## When it fires

```
# With config: { ".ts": "kebab-case" } in src/
❌ src/myComponent.ts          # should be my-component.ts
❌ src/MyModule.ts             # should be my-module.ts
❌ src/my_util.ts              # should be my-util.ts

# With matchDirectory: true
❌ src/foo/bar.ts              # should be src/foo/foo.ts or src/foo/index.ts
```

## How to fix

Rename the file to match the configured style or directory name, or add it as an allowed exception in the rule configuration.
