---
name: no-console-log
type: rule
title: Disallow console.log in source files
tags: [log, debug, code-cleanup]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Forbids `console.log(...)` calls in TypeScript/JavaScript source. Test files are excluded. Auto-fixable — removes the offending line.

## Why use this rule

- Debug logs left in production clutter stdout
- Sensitive data (tokens, user info) can leak
- A proper logging layer gives structure + log levels

## When it fires

A line contains `console.log(` in `.ts/.tsx/.js/.jsx` outside `test/`

## How to fix

Replace with proper logging (pino / winston) or remove
