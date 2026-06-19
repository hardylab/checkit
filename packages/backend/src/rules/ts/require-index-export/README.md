---
name: require-index-export
title: Require explicit re-exports in index.ts
tags: [barrel, public-api]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

A module's public API must be enumerated in its `index.ts` via explicit `export {...}` lines — no implicit wildcard re-exports.

## Why use this rule

- Implicit `export *` hides private modules
- Explicit index = clear public API
- Better tree-shaking

## When it fires

A module's `index.ts` has `export *`

## How to fix

Replace with `export { Foo, Bar } from "./foo"`
