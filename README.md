# CheckIt

> **Compile-time testing for TypeScript projects.**
> The first linter that **detects + explains + fixes** — with AI built in.

```bash
$ pnpm exec checkit --ai-fix
[WARNING] structure - console.log detected (src/main.ts:1)
[WARNING] type-safety - Avoid using 'any' type (src/main.ts:2)
[WARNING] structure - console.log detected (src/main.ts:3)

🤖 AI-Fix: 3 issue(s) to fix
   agent:   opencode
   fixed:   3/3
   failed:   0
   skipped:  0
```

See [`examples/KILLER-DEMO.md`](./examples/KILLER-DEMO.md) for the 60-second walkthrough.

### Real terminal output (captured by `examples/scripts/demo.sh`)

After `pnpm exec checkit` on a fresh project with bad code:

```
$ cd examples/01-quickstart
$ pnpm add -D @checkit/cli
$ pnpm exec checkit
[WARNING] structure - console.log detected (src\main.ts:6)
[WARNING] type-safety - Avoid using 'any' type — use 'unknown' + type guard or specific type instead (src\main.ts:7)
[ERROR] structure - 目录 "." 缺少 index.ts 用于统一导出 (index.ts)
[ERROR] structure - 目录 "src" 缺少 index.ts 用于统一导出 (src\index.ts)
```

After adding `--ai-fix`:

```
$ pnpm exec checkit --ai-fix
[WARNING] structure - console.log detected (src\main.ts:5)
[WARNING] structure - console.log detected (src\main.ts:11)
[WARNING] structure - console.log detected (src\main.ts:19)
[WARNING] type-safety - Avoid using 'any' type (src\main.ts:6)

🤖 AI-Fix: 4 issue(s) to fix
   agent:   opencode
   fixed:   4/4
   failed:   0
   skipped:  0
```

Full reproducible captures in [`docs/screenshots/`](./docs/screenshots/).

## Why CheckIt?

| Tool       | Catches                                         |
|------------|-------------------------------------------------|
| `tsc`      | type errors                                     |
| `eslint`   | style + a few patterns                          |
| `prettier` | formatting                                      |
| `vitest`   | runtime behavior                                |
| **`checkit`** | **architecture, team conventions, AI-Fix**  |

ESLint makes you write the rules. **CheckIt ships 29 of them, and fixes
the issues with an AI agent if you ask.** No competitor does this in
mid-2026.

## Install

```bash
pnpm add -D @checkit/cli
# or
npm install -D @checkit/cli
# or
yarn add -D @checkit/cli
```

Requires Node ≥ 18.

## Quick start (60 seconds)

### 1. See what's wrong

```bash
pnpm exec checkit
```

CheckIt auto-loads `checkit.config.ts` from your project root, falls
back to the built-in `normalParadigm` (29 rules), and prints issues.

### 2. Get an example running

Three example projects in `examples/`:

```bash
cd examples/01-quickstart     # 5 minutes — see issues caught
cd examples/02-custom-rule    # 10 minutes — write your own rule
cd examples/03-ai-fix         # 5 minutes — let AI auto-fix
```

Each one is a self-contained project. `pnpm install && pnpm review`.

### 3. Add to CI

```bash
pnpm exec checkit --reporter json | tee checkit-report.json
```

The JSON output is stable — pipe it into anything.

## CLI flags

| Flag                       | Effect                                                |
|----------------------------|-------------------------------------------------------|
| `--fix`                    | Apply built-in auto-fixes (deterministic)             |
| `--ai-fix`                 | Delegate fixes to an AI agent (opencode / claude / …) |
| `--ai-agent <name>`        | Force a specific agent                                |
| `--reporter stylish\|json\|silent` | Output format (default: stylish)              |
| `--config <name\|path>`    | Pick a paradigm (`strict` / `legacy` / `default`)     |
| `--rule <id>=<level>`      | Override one rule's level (e.g. `no-console-log=error`) |
| `--ignore <glob>`          | Add ignore patterns (repeatable)                      |
| `--recent [N]`             | Only check files modified in the last N minutes       |
| `--dev`                    | **CheckIt self-check mode** — scans its own source    |

## Configure with `checkit.config.ts`

```ts
import type { CheckitConfig } from '@checkit/cli';

const config: CheckitConfig = {
  rules: {
    'no-console-log': 'error',         // promote to error (default: warn)
    'no-any-rule': 'error',
    './.checkit/rules/my-rule.ts': 'warn',
  },
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  reporter: 'stylish',
};

export default config;
```

`.ts` config files support `import`, conditionals, and constants — see
[`docs/configuration.md`](./docs/configuration.md) for the full schema.

## Write your own rule

Place it at `.checkit/rules/<name>.ts`:

```ts
import fs from 'fs';
import path from 'path';
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/cli';

class NoLodashRule implements ReviewRule {
  static id = 'no-lodash';
  id       = 'no-lodash';
  glob     = '**/*.{ts,tsx}';
  level    = 'warn' as const;

  check(ctx: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    for (const file of ctx.files) {
      if (file.startsWith('.checkit/')) continue;
      const abs = path.join(ctx.targetPath, file);
      if (!fs.statSync(abs).isFile()) continue;
      const lines = fs.readFileSync(abs, 'utf-8').split('\n');
      lines.forEach((line, i) => {
        if (/from\s+['"]lodash/.test(line)) {
          issues.push({
            type: 'no-lodash',
            module: 'no-lodash',
            file,
            line: i + 1,
            issue: "Banned import 'lodash' — use native ES utilities",
            expect: 'Replace lodash with native Array/Object methods',
            level: 'warn',
          });
        }
      });
    }
    return issues;
  }
}

export default NoLodashRule;
```

See `examples/02-custom-rule/` for the full working version.

## What's new in 0.1.0

- **Package name**: `@checkit/cli` (single bundle, types inlined — install ONE package)
- **V4 intent engine** (always on) — handler chain dedupe → ignore → fix → escalate → report
- **29 built-in rules** — type safety, structure, security, style, architecture
- **AI-Fix** built in (`--ai-fix`) — auto-detects opencode / claude / hermes / openclaw
- **`--dev` mode** — CheckIt self-checks against its own contract
- **216/216 unit tests passing**

## Architecture

- **Intent engine** — every rule emits `Rule.Found` intents; handlers dedupe, ignore, fix, escalate, report
- **Paradigm system** — `normalParadigm` (29 rules), `devParadigm` (3 meta-rules for self-check), extensible via `extends: [...]`
- **Rule marketplace** — each rule ships with `<name>.md` frontmatter (OKF v0.1) so AI agents can consume them

See [`docs/architecture.md`](./docs/architecture.md) (TODO) for the full picture.

## License

MIT © 2026 hardylab