---
type: rule
name: okf-compliance
title: Enforce Open Knowledge Format v0.1 frontmatter on .md files
tags: [documentation, okf, knowledge, ai-agent]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

`.md` files must include OKF v0.1 frontmatter fields (`type`, `title`, `timestamp`) so AI agents and humans can consume them consistently across tools (Obsidian, Cursor, Claude Code).

## Why use this rule

- **OKF v0.1 spec** (Google Cloud 2026-06-12) is becoming the de-facto standard for LLM-wiki format
- Without `type: rule`, AI agents can't distinguish rules from docs from runbooks
- Without `timestamp`, no version control / freshness signal
- checkit rule doc = 30 .md files; keeping them OKF-compliant = first adoption

## When it fires

The rule scans every `.md` file in the target directory (excluding `test/`, `node_modules/`, `dist/`). It parses the YAML frontmatter (between `---` markers) and reports when any of these 3 required fields is missing or empty:

- `type` — semantic type (`rule` | `doc` | `wiki` | `bundle` | `concept`)
- `title` — short title
- `timestamp` — ISO8601 date (`YYYY-MM-DD`)

`tags`, `description`, and `resource` are OKF-spec but **optional** for now (warn only on the 3 critical).

### Example violation

```markdown
---
name: my-rule
---

## Body...
```

Issue output:

```
[WARN] documentation - my-rule.md missing OKF frontmatter fields: type, title, timestamp — OKF v0.1 spec requires type, title, timestamp for AI-agent consumption (my-rule.md)
```

### Fixed version

```markdown
---
name: my-rule
type: rule
title: My Rule
timestamp: 2026-06-20
---

## Body...
```

## How to fix

The rule's `fix()` method auto-repairs missing fields (only `type` and `timestamp`; `title` requires human judgment). To invoke:

```bash
checkit run --rule=okf-compliance --fix
```

The fix is **rule-scoped**, not a global ai-fix. Each rule knows how to fix its own issues.

## Configuration

No options. Levels: `warning` (default) or `error` (strict).

```json
{
  "rules": {
    "./.checkit/rules/okf-compliance/okf-compliance.rule.ts": "warning"
  }
}
```

## Why this rule exists (meta note)

`okf-compliance` is itself a checkit rule. It enforces OKF compliance on all `.md` files, **including its own README.md**. If you remove this rule's `okf-compliance.md`, this very rule will report a violation on itself. This is intentional — it demonstrates self-enforcement and serves as a living example of the OKF spec.

## OKF v0.1 spec

Published 2026-06-12 by Google Cloud. 6 core frontmatter fields:

| Field | Type | Required by this rule |
|---|---|---|
| `type` | enum | ✓ |
| `title` | string | ✓ |
| `description` | string | (optional) |
| `resource` | URI | (optional) |
| `tags` | array | (optional) |
| `timestamp` | ISO8601 | ✓ |

Source: <https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing>

## Rule metadata

- **Status**: `stable` — OKF v0.1 is Google's published spec.
- **Replaces**: no equivalent rule before (OKF is new).
- **Conflicts with**: none.
- **Related**: `rule-self-check` (which checks rule doc exists; `okf-compliance` checks the doc is OKF-compliant).
- **Maintainer**: Hardy.
- **Test coverage**: 0 unit tests (rule just added 2026-06-20).

## Self-bootstrap demo

This rule was created on 2026-06-20 and immediately added its own README. To verify it works:

1. Temporarily delete `type: rule` from this file's frontmatter
2. Run `checkit run --rule=okf-compliance`
3. Observe the violation reported on its own README
4. Restore the field
5. Run again → 0 issues

This proves the rule catches what it preaches.
