---
name: require-test-file
title: Require corresponding test file for every source module that defines functions
tags: [testing, coverage]
severity: warn
status: stable
since: 0.1.0
---

## TL;DR

Ensures every `.ts` source file that defines functions or classes has a matching `.test.ts` file, either in the same directory or in a sibling `test/` subdirectory.

## Why use this rule

- Catches untested code at review time by enforcing that logic-bearing modules always have a corresponding test file.
- Promotes a consistent test-file layout — teams can choose co-located tests or a `test/` subdirectory, and the rule handles both.
- Prevents accidental blind spots when adding new exports to existing files.

## When it fires

```ts
// src/services/user.ts — defines functions but no user.test.ts exists
export function createUser() { ... }
export class UserService { ... }
```

Produces a warning: _"Missing test file 'user.test.ts' in same directory or 'test/' subdirectory."_

## How to fix

Create the missing `*.test.ts` file in the same directory as the source file, or in a `test/` subdirectory relative to it.
