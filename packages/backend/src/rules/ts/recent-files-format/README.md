---
name: recent-files-format
title: Enforce formatting on recently modified files
tags: [formatting, freshness]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Files modified within `--recent` minutes must be correctly formatted (Prettier-compatible). Catches forgotten formatters.

## Why use this rule

- Catches "I forgot to format" in code review
- Forces clean diff for recent work
- Reduces stylistic comments in PRs

## When it fires

A recently modified file fails `prettier --check`

## How to fix

Run `prettier --write <file>`
