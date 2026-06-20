---
name: utf8-encoding-required
type: rule
title: Require UTF-8 encoding for text files
tags: [encoding, i18n]
severity: warning
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

All text files must be UTF-8 encoded (without BOM). Non-UTF-8 files break unicode handling and cause `SyntaxError: Invalid or unexpected token` in some tools.

## Why use this rule

- UTF-8 is the universal default for source code
- BOM breaks some parsers (`tsc`, `node --experimental-vm-modules`)
- Non-UTF8 (Latin1, GBK) creates mojibake in any non-local viewer

## When it fires

A text file contains non-UTF-8 bytes (or starts with U+FEFF BOM)

## How to fix

Re-save the file as UTF-8 (no BOM) using your editor's "Save with Encoding"
