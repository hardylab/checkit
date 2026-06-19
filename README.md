# CheckIt

> 编译期测试 / Compile-time testing for TypeScript projects
>
> 把"团队范式"变成"编译期可执行约束" / Enforce team conventions at compile time

CheckIt is a linter / static analysis tool that goes beyond `tsc` and `eslint`. It enforces **domain-specific architectural conventions** (paradigms) in TypeScript projects — at compile time, before code is even run.

## Why?

- **tsc** checks types
- **eslint** checks style
- **vitest** checks behavior
- **checkit** checks whether code follows your team's **architecture paradigm**

Examples of conventions CheckIt can enforce:

- "No React hooks inside `*.tpl.tsx` widget templates"
- "All `*.service.ts` files must be pure functions, no React imports"
- "Widget directories must have 4 files: `tpl.tsx` + `service.ts` + optional `frame.tsx` + `handlers.ts`"
- "Git history must not contain AWS keys or GitHub tokens"
- "No single file larger than 1MB should be committed"

## Features

- **30+ built-in rules** covering type safety, structure, security, style
- **Project-local rules** — write your own rules in `.checkit/rules/`
- **Multiple paradigms** — `default.config.ts` (baseline) + `strict.config.ts` (stricter) + `legacy.config.ts` (looser) can coexist
- **TypeScript config** — `.ts` config files support imports, comments, conditionals
- **V4 intent engine** — extensible handler chain (dedupe → ignore → fix → escalate → report)
- **203/205 tests passing** (2 known baseline issues in V3)

## Quick start

```bash
# Install
pnpm add -D @checkit/cli

# Run with default config
pnpm review

# Run with V4 intent engine
pnpm review --v4

# Use a specific paradigm
pnpm review --config strict
```

## Project-local config

Create `.checkit/default.config.ts` in your project:

```ts
import type { CheckitConfig } from 'checkit-backend-types';

const config: CheckitConfig = {
  rules: {
    './.checkit/rules/my-rule.ts': 'error',
    'no-console-log': 'warn',
  },
  ignorePatterns: ['**/node_modules/**', '**/dist/**'],
  reporter: 'stylish',
};

export default config;
```

Place your custom rules in `.checkit/rules/`:

```ts
// .checkit/rules/my-rule.ts
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';

class MyRule implements ReviewRule {
  id = 'my-rule';
  check(ctx: RuleContext): ReviewIssue[] {
    // ... your logic
  }
}

export default MyRule;
```

## Documentation

See [`docs/configuration.md`](./docs/configuration.md) for full configuration reference.

## License

MIT © 2026 hardylab
