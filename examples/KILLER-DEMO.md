# 🎬 Killer demo — 60 seconds

This is the entire sales pitch in one terminal session. Copy-paste
into a fresh project, screenshot the output, post it.

## Step 1 — install (10s)

```bash
mkdir demo && cd demo && echo '{"name":"demo","version":"0.0.1"}' > package.json
pnpm add -D @checkit/cli
mkdir src
cat > src/main.ts <<'EOF'
console.log("oops");
const x: any = 1;
console.log(x);
EOF
```

## Step 2 — see issues (5s)

```bash
pnpm exec checkit
```

```
[WARNING] structure - console.log detected (src\main.ts:1)
[WARNING] type-safety - Avoid using 'any' type (src\main.ts:2)
[WARNING] structure - console.log detected (src\main.ts:3)
```

## Step 3 — auto-fix with AI (45s)

```bash
pnpm exec checkit --ai-fix
```

```
🤖 AI-Fix: 3 issue(s) to fix
   agent:   opencode
   fixed:   3/3
   failed:  0
   skipped: 0

✨ Re-run `checkit` to verify the fixes.
```

## Step 4 — verify (5s)

```bash
pnpm exec checkit
```

```
✅ no issues — clean.
```

## That's it

Total wall-clock: under 90 seconds.

**Three lines of bad code → three issues found → AI fixes all three → re-run shows clean.**

That's the demo.

## Underlying mechanism

| What you saw | What's happening |
|---|---|
| `checkit` runs 29 built-in rules | `normalParadigm` loaded automatically |
| `--ai-fix` finds opencode | `pickFirstAvailable()` detects installed agents |
| AI fixes the issues | Each issue → file context → prompt → agent → writeFile |
| Re-run shows clean | (For demo only — in CI you'd add `--verify` to auto-loop) |

## Why this matters

ESLint needs hand-written rules + a maintainer who knows how to fix.
TypeScript catches types but not structure / conventions.
Prettier formats but doesn't *decide* what's right.

CheckIt is the first linter that **detects + explains + fixes** in
one pipeline — including the "fix" step being delegated to a real AI.

No competitor does this in 2026-06.