# demo.sh — Reproducible killer demo

A single shell script that runs all three examples end-to-end and
captures the terminal output to text "screenshots" under
[`docs/screenshots/`](../../docs/screenshots/).

## Why this exists

You should be able to regenerate every screenshot in the README in
under 2 minutes. If the demo breaks, the screenshot is wrong. If the
screenshot works, the demo works.

## Usage

```bash
# Quick (just example 01, 60s)
bash examples/scripts/demo.sh --quick

# Full (all three, ~2 minutes + AI-Fix wait)
bash examples/scripts/demo.sh
```

The script:

1. Builds `@checkit/cli` tarball if missing (`pnpm build && pnpm pack`)
2. For each example:
   - Copies it into a Windows-reachable temp dir
   - Strips the placeholder `devDependencies` (so pnpm doesn't hit the
     registry for an unpublished package)
   - `pnpm add -D <tarball>` — installs the freshly built CLI
   - Runs `pnpm exec checkit` (and `--ai-fix` for example 03)
   - Captures stdout + stderr to `docs/screenshots/<example>-<cmd>.txt`

## Output

```
docs/screenshots/
├── 01-review.txt    — quickstart: 4 issues caught (console.log, any, missing index.ts × 2)
├── 02-review.txt    — custom rule: "no-lodash" flags the lodash import
├── 03-review.txt    — ai-fix pre-state: 4 issues
└── 03-ai-fix.txt    — ai-fix post-state: 🤖 AI-Fix banner + agent summary
```

## Cross-platform notes

This script has been verified on **Git Bash on Windows**. The non-obvious
bits:

| Bit                                | Why                                                  |
|------------------------------------|------------------------------------------------------|
| `mktemp -d -p "$USERPROFILE/..."`  | `/tmp` is a virtual MSYS mount, pnpm subprocess (Windows cmd) can't `cd` into it |
| `to_win_path()` helper             | Translates `/d/foo` → `D:\foo` so pnpm finds files; pnpm rejects lowercase drive letters |
| Strip `devDependencies` first      | The placeholder `"@checkit/cli": "^0.1.0"` makes pnpm hit the npm registry and fail |
| `pnpm exec checkit`                | `pnpm review` (using a script name) won't work on Windows cmd — the binary isn't on PATH for the cmd subprocess |
| `set -uo pipefail` (not `-e`)      | A failing example shouldn't kill the rest of the run |
| `cleanup()` not inline `rm -rf`    | Trap on `set -e` exit was too eager; one failure nuked the screenshot |

If you find a new platform bug, update this script **and** the table.