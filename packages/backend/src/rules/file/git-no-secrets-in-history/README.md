---
name: git-no-secrets-in-history
title: Scan git history for leaked secrets
tags: [git, security]
severity: error
status: stable
since: 0.1.0
---

## TL;DR

Scans the last 50 commits for credentials (AWS keys, GitHub tokens, JWTs, private keys). Leaked secrets in history are exposed even if the current working tree is clean.

## Why use this rule

- Git history is immutable — `git reset` doesn't erase
- A pushed commit is permanent
- Tools like `gitleaks` exist for a reason

## When it fires

A past commit contains a credential pattern

## How to fix

Rotate the secret immediately, then rewrite history (`git filter-repo` or BFG)
