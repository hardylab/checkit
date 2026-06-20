---
name: env-var-check
type: rule
title: Validate environment variable usage
tags: [config, env, safety]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

`process.env.X` references must go through a typed config helper, not direct access. Prevents typos and undefined values.

## Why use this rule

- Typos in env var names fail silently
- Missing values crash at runtime
- Centralized config is easier to test

## When it fires

`process.env.SOMETHING` is read directly (not through a config helper)

## How to fix

Route reads through a typed config module (`config.get("SOMETHING")`)
