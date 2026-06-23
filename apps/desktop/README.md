# @checkit/desktop — Electron + Next.js shell

Native desktop app for checkit. Wraps the local `@checkit/cli` and
visualizes its output in a real Electron window.

## Architecture

```
┌─────────────────────────────────────────────┐
│            Electron main process             │
│  (apps/desktop/electron/main.cjs)           │
│  • spawns `checkit` CLI on user demand       │
│  • exposes IPC: scan / pickFolder / pickJson│
└──────────────────┬──────────────────────────┘
                   │ IPC
┌──────────────────▼──────────────────────────┐
│          Preload bridge                      │
│  (electron/preload.cjs)                     │
│  • contextBridge → window.checkit            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        Next.js 14 renderer                   │
│  (apps/desktop/app/)                        │
│  • React Server Components (static export)  │
│  • 4 routes: / /ai-fix /rules /chat         │
│  • design tokens: oklch sage-green palette  │
└─────────────────────────────────────────────┘
```

## Run in dev

```bash
# from checkit repo root
pnpm install

# Two processes run in parallel:
# 1. Next.js dev server on :3210
# 2. Electron window loading from http://localhost:3210
pnpm --filter @checkit/desktop dev
```

The Electron main process waits for port 3210 to be open before
launching the window (`wait-on tcp:3210`).

## Build for distribution

```bash
# Build the Next.js static export → apps/desktop/out
pnpm --filter @checkit/desktop build

# Package the Electron app for the current OS
pnpm --filter @checkit/desktop dist          # full installer
pnpm --filter @checkit/desktop package       # unpacked dir
```

Cross-platform outputs (from `electron-builder.json`):
- macOS: `.dmg`
- Windows: NSIS `.exe`
- Linux: AppImage

## IPC surface

The renderer accesses three things through `window.checkit`:

```ts
window.checkit.scan({ cwd?, fix?, aiFix? })  // → { ok, issues, exitCode }
window.checkit.pickFolder()                  // → string | null
window.checkit.pickJson()                    // → { name, data } | { error } | null
window.checkit.reveal(path)                  // → void (show in OS file manager)
```

`window.checkit` is undefined when the renderer is loaded outside Electron
(e.g. opening the Next.js dev URL directly in a browser). Pages detect this
and disable the "scan folder" button.

## Why this design

| Decision | Reason |
|---|---|
| Static export (`output: 'export'`) | Lets us ship a real desktop binary without a Node server inside Electron |
| `wait-on tcp:3210` | Avoids the "window opened before dev server is ready" race |
| IPC via `contextBridge` (not `nodeIntegration`) | Renders are untrusted; only the preload can touch Node |
| Path to checkit via monorepo walk | In dev: `packages/backend/dist/cli.cjs`. In packaged: `extraResources/checkit-cli/` |

## File map

```
apps/desktop/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx                # root layout
│   ├── page.tsx                  # / — main dashboard
│   ├── ai-fix/page.tsx           # /ai-fix — per-issue AI view
│   ├── rules/page.tsx            # /rules — V2 placeholder
│   ├── chat/page.tsx             # /chat — V2 placeholder
│   ├── components/Shell.tsx      # top bar + rail + icons
│   ├── lib/report.ts             # normalize + score + categorize
│   ├── types/electron.d.ts       # window.checkit typing
│   └── globals.css               # full design tokens + components
├── electron/
│   ├── main.cjs                  # BrowserWindow + IPC handlers
│   └── preload.cjs               # contextBridge surface
├── electron-builder.json
├── next.config.js
├── tsconfig.json
└── package.json
```