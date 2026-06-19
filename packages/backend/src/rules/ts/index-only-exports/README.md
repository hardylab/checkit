---
name: ts\index-only-exports\index-only-exports
title: Enforce index.ts files to only re-export symbols, never define them
tags: [architecture, module-boundaries]
severity: warn
status: stable
since: 0.1.0
---

## TL;DR

Ensures `index.ts` files act as pure barrel modules — they may only re-export from other files, not define functions, objects, classes, or any other implementation code.

## Why use this rule

- Keeps barrel files predictable and side-effect-free, making the module graph easier to reason about.
- Prevents accidental duplicate definitions or initialization order bugs when the same file both defines and re-exports.
- Enforces a clean separation between implementation modules and public API surfaces.

## When it fires

```ts
// user/index.ts — fires because 'doSomething' is defined inline
export function doSomething() {
  return 42;
}
export * from './helpers';
```

## How to fix

Move any implementation code (function, class, object, etc.) into a separate module file and add a re-export line for it in `index.ts`.
