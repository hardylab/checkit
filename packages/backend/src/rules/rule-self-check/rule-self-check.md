---
name: rule-self-check
type: rule
title: Each rule must have a README.md for the marketplace
tags: [meta, documentation, marketplace]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Every `<name>.rule.ts` must have a sibling `README.md` with frontmatter (name, title, tags, severity, status) for the rule marketplace display.

## Why use this rule

- Rules without README are invisible in the marketplace
- Forces a consistent doc surface (TL;DR + examples + config)
- Self-bootstraps checkit's own documentation

## When it fires

A `<name>.rule.ts` has no `README.md` next to it

## How to fix

Create `README.md` using the standard template (frontmatter + TL;DR + Why + When + How to fix)
