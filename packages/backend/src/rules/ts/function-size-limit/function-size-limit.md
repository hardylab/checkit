---
name: function-size-limit
type: rule
title: Limit function size
tags: [readability, maintainability]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Functions exceeding N lines must be split. Forces single-responsibility.

## Why use this rule

- Long functions hide bugs
- Hard to test, hard to name
- Often signal a missing abstraction

## When it fires

A function body exceeds the configured line limit (default 50)

## How to fix

Extract sub-functions; or split into multiple modules
