---
name: plaintext-credentials
type: rule
title: Disallow plaintext credentials in source code
tags: [security, credentials]
severity: error
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Bans hard-coded passwords, API keys, tokens, and other secrets. They end up in git history and leak via search.

## Why use this rule

- Git history is forever — secrets are forever leaked
- Any contributor with read access sees them
- Robots scrape public repos for keys

## When it fires

A line matches a credential pattern (password = "...", api_key = "...", AWS keys, GitHub tokens, etc.)

## How to fix

Move to a secrets manager (1Password, AWS Secrets Manager) or environment variable
