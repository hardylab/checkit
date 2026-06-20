---
name: require-tsconfig-one-way-references
title: Require TypeScript project references to form a directed acyclic graph
tags: [typescript, architecture]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Ensures `tsconfig.json` project references never create circular dependencies between TypeScript projects.

## Why use this rule

- Circular project refs cause unpredictable build ordering and infinite loops in `--build` mode
- Enforcing a DAG keeps the project graph maintainable
- Catches unintended coupling between packages

## When it fires

Project A references B, and B references A (transitively)

## How to fix

Extract shared types to a leaf package both depend on
