---
name: git-no-large-files
type: rule
title: Block large files from git history
tags: [git, hygiene]
severity: error
status: stable
since: 0.1.0
timestamp: 2026-06-20
---

## TL;DR

Files exceeding 1 MB cannot be added to git. Prevents binary blobs, build artifacts, and node_modules from bloating the repo.

## Why use this rule

- Git stores full file contents on every change
- Cloning a 1 GB repo for 1 KB of source is hostile
- LFS or external storage is the right answer

## When it fires

A file larger than 1 MB is staged

## How to fix

Add the path to `.gitignore` and remove the file from history (`git rm --cached`)
