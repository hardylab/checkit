---
name: spec-traceability-check
title: Enforce spec traceability annotations on recently modified source files
tags: [traceability, documentation, specification]
severity: warn
status: stable
since: 0.1.0
---

## TL;DR

Ensures recently modified `.ts`/`.tsx` files (especially controllers/services) contain a `// spec:[spec](/path/to/spec)` annotation linking to a specification document, and validates that the referenced spec file exists and has substantive content.

## Why use this rule

- Prevents code from being reviewed or merged without an associated spec, enforcing bidirectional traceability between implementation and specification.
- Catches broken spec links early — if a referenced spec file is missing or empty, the rule flags it as an error.
- Scoped to recently changed files (default 60 min window) so it provides fast feedback during development without overwhelming existing code.

## When it fires

```ts
// File: src/controllers/user.controller.ts (recently modified, no spec annotation)
export class UserController { ... }
```

Produces a warning: _"缺少规范追踪注释：请在文件顶部添加 // spec:[spec](/specs/...) 链接"_

If a `// spec:[spec](/specs/foo.md)` link exists but `foo.md` does not exist, produces an error: _"关联的 spec 文件不存在"_

## How to fix

Add a `// spec:[spec](/specs/<path>)` comment at the top of the file pointing to the relevant specification document, or run `openspec` to auto-generate and insert the spec link.
