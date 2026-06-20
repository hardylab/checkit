---
name: ts\no-circular-dependency\no-circular-dependency
type: rule
title: Detect and prevent circular dependencies between source files
tags: [architecture, module-boundaries]
severity: warn
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Detects import cycles (A → B → C → A) in TypeScript/JavaScript files to prevent runtime initialization deadlocks and fragile module coupling.

## Why use this rule

- Circular dependencies cause brittle module graphs that are hard to refactor and understand.
- They can lead to unexpected `undefined` values at runtime due to partial module initialization in CommonJS/ESM interop scenarios.
- Enforcing acyclic imports keeps the dependency graph simple, testable, and incrementally composable.

## When it fires

If `a.ts` imports `b.ts` and `b.ts` imports `a.ts`:

```ts
// a.ts
import { B } from './b';
export const A = 'a';

// b.ts
import { A } from './a'; // circular!
export const B = 'b';
```

The rule reports the full cycle chain, e.g. `a.ts -> b.ts -> a.ts`.

## How to fix

Extract the shared dependency into a new common file that both modules can import, or restructure the modules so that one direction of the cycle is removed.
