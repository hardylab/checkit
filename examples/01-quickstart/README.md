# 01 — Quickstart

5 minutes. You'll see CheckIt catch `console.log`, `any` types, and a
missing barrel `index.ts` — three real issues that ESLint usually misses
or that need hand-written rules.

## Run

```bash
cd examples/01-quickstart
pnpm install
pnpm review
```

## Expected output

```
[ERROR] type-safety - Avoid using 'any' type — use 'unknown' + type guard or specific type instead (src\main.ts:4)
[ERROR] structure - console.log detected (src\main.ts:3)
[WARNING] structure - 目录 "src" 缺少 index.ts 用于统一导出 (src\index.ts)
```

## What just happened

| Rule fired on          | What it enforces                  | Why it matters                |
|------------------------|-----------------------------------|-------------------------------|
| `no-any-rule`          | bans `: any` in TypeScript        | `any` defeats the type system |
| `no-console-log`       | bans `console.log` in app code    | logs leak to prod silently    |
| `require-index-export` | every directory has `index.ts`    | scattered imports → no barrel |

## Next

- `examples/02-custom-rule/` — write your own rule (5 min more)
- `examples/03-ai-fix/` — let CheckIt auto-fix the issues