---
name: use-spec-coding
type: rule
title: Enforce spec-coding annotation on source files
tags: [documentation, spec, annotation]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Source files must reference a corresponding spec at the top via the `// spec:[path](url)` annotation.

## Why use this rule

- Keeps code and documentation in sync
- Helps reviewers trace any source file back to its spec
- Catches dead specs (no code) and rogue code (no spec)

## When it fires

File has no `spec:` comment near the top

## How to fix

Add `// spec:[spec-name](specs/path.md#L1)` at the top of the file
