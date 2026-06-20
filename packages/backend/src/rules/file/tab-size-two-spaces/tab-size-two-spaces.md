---
name: tab-size-two-spaces
title: Enforce 2-space indentation (no tabs)
tags: [formatting, indentation]
severity: warning
status: stable
since: 0.1.0
---

## TL;DR

Source files must use 2-space indentation, never tabs. Tab-width assumptions vary by editor and cause diff churn.

## Why use this rule

- 2-space is the de-facto JS/TS standard (npm, prettier default)
- Tabs render at different widths across editors
- Tab vs space diffs are noise that masks real changes

## When it fires

A line begins with a tab character

## How to fix

Convert tabs to 2 spaces (most editors: "Convert Indentation to Spaces")
