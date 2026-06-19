---
name: file\doc-pattern\doc-pattern
title: Enforce required project file and directory structure
tags: [file, structure, architecture]
severity: warn
status: stable
since: 0.1.0
---

## TL;DR

Ensures that specified files and directories exist in the project structure, with optional content validation via custom checker functions.

## Why use this rule

- Enforces a consistent project scaffolding across modules or repositories.
- Catches missing configuration files, documentation, or required directories early.
- Supports both existence checks and custom content pattern validation (e.g., a README must contain specific sections).

## When it fires

```jsonc
// checkit config
{
  "rules": {
    "doc-pattern": {
      "options": {
        "README.md": true,
        "docs/": {},
        "CHANGELOG.md": (content) => content.includes('##')
      }
    }
  }
}
```

Fires with `error` when `README.md`, `docs/`, or `CHANGELOG.md` (failing content validation) is missing.

## How to fix

Create the missing files or directories as required by the rule configuration, or adjust the pattern options if they no longer reflect the intended structure.
