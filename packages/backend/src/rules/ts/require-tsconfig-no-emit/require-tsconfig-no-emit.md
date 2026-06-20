---
name: require-tsconfig-no-emit
type: rule
title: Require compilerOptions.noEmit in all tsconfig files
tags: [typescript, config]
severity: warn
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Ensures every `tsconfig*.json` file has `compilerOptions.noEmit` set to `true`, preventing accidental type-checking output when the project uses a separate bundler (e.g. tsup, esbuild, swc) for compilation.

## Why use this rule

- Prevents stale `.js`/`.d.ts` emit files from polluting the source tree when `tsc` is run only for type-checking.
- Enforces a clean separation of concerns: `tsc` for type-checking only, bundler for output.
- Reduces confusion in CI/CD — build artifacts come from a single source (the bundler), not mixed `tsc` output.

## When it fires

```jsonc
// tsconfig.json — missing compilerOptions.noEmit
{
  "compilerOptions": {
    "strict": true,
  },
}
```

## How to fix

Set `compilerOptions.noEmit` to `true` in the tsconfig file, or run the rule's autofix to apply it automatically.
