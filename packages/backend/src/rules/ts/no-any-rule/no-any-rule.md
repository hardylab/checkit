---
name: no-any-rule
type: rule
title: Disallow the any type in TypeScript code
tags: [typescript, type-safety]
severity: error
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Bans `any` (used as type annotation, return type, or `as any` cast) in source files. Forces explicit unknown / generic types.

## Why use this rule

- `any` defeats TypeScript type checking
- Hides real bugs from the compiler
- Makes refactoring unsafe

## When it fires

`any` appears as a type or in a type assertion

## How to fix

Replace with `unknown` (input) or a proper generic / interface (output)
