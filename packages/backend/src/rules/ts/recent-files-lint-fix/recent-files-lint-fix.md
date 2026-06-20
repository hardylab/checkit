---
name: recent-files-lint-fix
type: rule
title: Apply lint --fix on recently modified files
tags: [lint, freshness]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Files modified within `--recent` minutes must pass linting with `--fix` applied. Auto-fixable.

## Why use this rule

- Forces clean state on touched code
- Catches `eslint-disable` lines being added without fixing the underlying issue
- Keeps the codebase "as if auto-formatted"

## When it fires

A recently modified file has auto-fixable lint errors

## How to fix

Run `eslint --fix <file>`
