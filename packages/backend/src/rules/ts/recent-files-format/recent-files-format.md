---
name: ts\recent-files-format\recent-files-format
title: Check recent files are formatted with Prettier
tags: [formatting, prettier]
severity: warn
status: stable
since: 0.1.0
---

## TL;DR

Ensures files modified within a configurable time window (default 60 min) are properly formatted with Prettier.

## Why use this rule

- Catches unformatted files immediately after save, before they reach code review
- Auto-fixable — runs `prettier --write` on the offending file with one click
- Keeps the codebase consistently formatted without running full-project formatting

## When it fires

```ts
// A file was edited within the last 60 minutes but is not Prettier-compliant
```

## How to fix

Run `prettier --write <file>` manually or apply the auto-fix provided by the rule.
