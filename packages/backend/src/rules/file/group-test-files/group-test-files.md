---
name: group-test-files
title: Group test files in dedicated test/ directory
tags: [structure, testing, organization]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Test files (`.test.ts` / `.spec.ts`) must live in a `test/` subdirectory, not next to source.

## Why use this rule

- Separates test code from production code at the package boundary
- Avoids shipping test files in npm tarballs
- Standardizes test discovery across packages

## When it fires

A `.test.ts` or `.spec.ts` file is found outside `test/`

## How to fix

Move the file to the nearest `test/` subdirectory
