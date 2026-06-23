# @checkit/web — Companion UI for the checkit CLI

This package is the **visualization layer** for `checkit` CLI output.
Run checkit in your project, dump the JSON report, drop it into this
UI, browse issues, drill into AI-Fix diffs.

```
# 1. Run checkit in your project
$ cd ~/code/my-app
$ pnpm exec checkit --reporter json > checkit-report.json

# 2. Open the Web UI
$ open packages/web/index.html        # macOS
$ xdg-open packages/web/index.html    # Linux
$ start packages/web/index.html       # Windows cmd
# or just drag the file into your browser

# 3. Drop checkit-report.json onto the page
```

## Why static HTML, no build?

- Zero install for the user — open `index.html`, done.
- checkit is a CLI tool. The Web UI is for **humans** to look at
  results, not for shipping production assets.
- One JS file (`app.js`) + one CSS file (`app.css`) per screen keeps
  it auditable. No bundler magic.

## Layout

| File                 | What it shows                                    |
|----------------------|--------------------------------------------------|
| `index.html`         | Dashboard — health score, issue list, AI-fix CTA |
| `ai-fix.html`        | Per-issue AI fix view — patch diff, plan, accept |
| `rules-market.html`  | Rules marketplace (placeholder for V2)           |
| `chat.html`          | Chat assistant (placeholder for V2)              |
| `app.css`            | Shared design tokens + component styles          |
| `app.js`             | Shared helpers: loadReport(), render(), router   |
| `rules.js`           | Rules marketplace data + renderer                |

## Data contract

Input is whatever `checkit --reporter json` writes. Schema (one issue):

```ts
{
  type: string         // e.g. "structure", "type-safety"
  module: string       // rule id, e.g. "no-console-log"
  file: string | null  // relative path; null for project-level issues
  line: number | null
  issue: string        // human message
  expect: string?      // how to fix
  level: 'error' | 'warning' | 'info'
  fixable: boolean
  data?: object
}
```

Plus a top-level `{ issues: [...], summary?: {...} }` wrapper if present.

## Roadmap

- V1 (this): static HTML, drop JSON, browse + AI-fix CTA
- V2: live `pnpm exec checkit --watch` from a button (via Tauri / native shell)
- V3: rules marketplace + chat panel
- V4: GitHub PR integration (post AI-fix as PR review comment)