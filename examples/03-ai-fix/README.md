# 03 — AI-Fix (killer demo)

This is what makes CheckIt different. After review, you can call
`--ai-fix` to have an AI agent automatically rewrite the offending code.

## Prerequisites

Install one of these AI agents (CLI subcommand, not the package):

- `opencode` — recommended, fast, free model tier
- `claude` — paid, slower, more careful
- `openclaw`
- `hermes` (this one — meta-programming risk, listed for completeness)

CheckIt auto-detects which are available.

## Run

```bash
cd examples/03-ai-fix
pnpm install

# 1. See what's broken
pnpm exec checkit

# 2. Let AI fix it
pnpm exec checkit --ai-fix

# 3. Re-run to verify (issues should be 0 or much less)
pnpm exec checkit
```

## What the output looks like

```
$ pnpm review
[ERROR] type-safety - Avoid using 'any' type (src\main.ts:4)
[ERROR] type-safety - Avoid using 'any' type (src\main.ts:8)
[ERROR] structure - console.log detected (src\main.ts:3)
[ERROR] structure - console.log detected (src\main.ts:11)
[ERROR] structure - console.log detected (src\main.ts:16)

$ pnpm ai-fix
🤖 AI-Fix: 5 issue(s) to fix
   agent:   opencode
   fixed:   5/5
   failed:  0
   skipped: 0

✨ Re-run `checkit` to verify the fixes.

$ pnpm review
✅ no issues — clean.
```

## Flags

| Flag | Effect |
|---|---|
| `--ai-fix` | Run AI on every issue after review |
| `--ai-agent <name>` | Force a specific agent (otherwise auto-pick) |
| `--ai-agent claude` | Example: force Claude |
| `--fix` | Built-in auto-fix only (no AI, deterministic transforms) |