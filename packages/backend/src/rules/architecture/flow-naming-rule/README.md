---
name: flow-naming-rule
title: Enforce flow / pipeline naming convention
tags: [naming, architecture]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Pipeline / flow files must follow `<verb>.<subject>.ts` convention (e.g. `parse.invoice.ts`, `send.email.ts`).

## Why use this rule

- Verb-first names read like a sentence at call sites
- Easy to grep for "what does this do"
- Distinguishes pipelines from utilities

## When it fires

A flow / pipeline file doesn't match `<verb>.<subject>.ts`

## How to fix

Rename to verb.subject.ts
