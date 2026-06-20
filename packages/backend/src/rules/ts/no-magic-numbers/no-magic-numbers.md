---
name: no-magic-numbers
type: rule
title: Disallow magic numbers in code
tags: [readability, magic-numbers]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Numeric literals in code must be named constants. Inline literal numbers (0, 1, -1 excepted) are flagged.

## Why use this rule

- `500` means nothing without context; `HTTP_STATUS_INTERNAL_ERROR` does
- Centralizes the place to change values
- Improves code review signal

## When it fires

A literal number appears outside an array index, comparison, or test

## How to fix

Extract to a named constant
