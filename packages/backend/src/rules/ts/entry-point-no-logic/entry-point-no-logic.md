---
name: entry-point-no-logic
title: Disallow business logic in entry-point files
tags: [architecture, entry-point]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Top-level entry points (`index.ts`, `main.ts`, `app.ts`) must be a thin shim that wires dependencies and delegates. Real logic belongs in services / modules.

## Why use this rule

- Entry points are hard to test directly
- Logic in entry points can't be reused
- Forces the dependency-injection pattern at the top of the dependency graph

## When it fires

An entry-point file contains non-trivial code (loops, conditionals, business logic)

## How to fix

Extract logic to a service; entry point just imports and wires it
