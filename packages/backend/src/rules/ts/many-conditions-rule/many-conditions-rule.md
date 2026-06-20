---
name: many-conditions-rule
type: rule
title: Limit the number of if/else branches in a function
tags: [readability, cyclomatic-complexity]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Functions with more than N branches (if/else, switch cases) trigger the rule. Forces decomposition.

## Why use this rule

- High cyclomatic complexity correlates with bugs
- Many branches = untestable
- Often a missing polymorphism / lookup table

## When it fires

A function has more than 6 conditional branches

## How to fix

Extract a strategy / lookup table / polymorphism; or split the function
