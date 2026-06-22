# 02 — Custom rule

Write your own rule in `.checkit/rules/`. This example bans `lodash`
imports (use native ES instead).

## Run

```bash
cd examples/02-custom-rule
pnpm install
pnpm exec checkit
```

## Expected output

```
[ERROR] no-lodash - Banned import 'lodash' — use native ES utilities instead (src\users.ts:2)
```

## Anatomy of a rule

```ts
class NoLodashRule implements ReviewRule {
  static id = 'no-lodash';        // unique rule id
  id       = 'no-lodash';
  glob     = '**/*.{ts,tsx}';     // files to scan
  level    = 'warn' as const;

  check(ctx: RuleContext): ReviewIssue[] {
    // ctx.targetPath  = the project root
    // ctx.files       = files matched by glob
    // return issues; each becomes one warning/error line
  }
}

export default NoLodashRule;
```

Then in `checkit.config.ts`:

```ts
rules: {
  './.checkit/rules/no-lodash.ts': 'error',  // ← path is relative to project root
}
```

## Make it smarter

Replace the regex with `ts.createSourceFile(...)` from the bundled
TypeScript compiler — CheckIt's built-in rules do this. Your rule has
access to the full TS AST.