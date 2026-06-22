#!/usr/bin/env bash
# Reproducible killer demo — runs all three examples end-to-end and saves
# the actual terminal output as text "screenshots" under docs/screenshots/.
#
# Usage:
#   bash examples/scripts/demo.sh           # full run, requires pnpm
#   bash examples/scripts/demo.sh --quick   # just example 01 (60s)
#
# Output:
#   docs/screenshots/01-review.txt          — quickstart output
#   docs/screenshots/02-review.txt          — custom rule output
#   docs/screenshots/03-review.txt          — AI-fix review output
#   docs/screenshots/03-ai-fix.txt          — AI-fix summary
#
# Each file is what you would copy-paste into a tweet / blog / landing page.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TGZ="$REPO_ROOT/packages/backend/checkit-cli-0.1.0.tgz"
OUT_DIR="$REPO_ROOT/docs/screenshots"

QUICK="${1:-}"
SHOULD_RUN_01=true
SHOULD_RUN_02=true
SHOULD_RUN_03=true
if [ "$QUICK" = "--quick" ]; then
  SHOULD_RUN_02=false
  SHOULD_RUN_03=false
fi

mkdir -p "$OUT_DIR"
# Use a Windows-reachable temp dir. Git Bash's $TMPDIR points at /tmp
# which is a virtual MSYS mount — pnpm subprocess (running as Windows
# cmd underneath) can't see it. Fall back to $USERPROFILE/AppData/Local/Temp
# when nothing Windows-native is exposed.
if [ -n "$USERPROFILE" ]; then
  WIN_TMP="$USERPROFILE/AppData/Local/Temp"
elif [ -n "$HOME" ]; then
  WIN_TMP="$HOME/.checkit-demo-tmp"
else
  WIN_TMP="$OUT_DIR/.work"
fi
mkdir -p "$WIN_TMP"
WORK="$(mktemp -d -p "$WIN_TMP" 2>/dev/null | tr -d '\r\n')"
if [ -z "$WORK" ] || [ ! -d "$WORK" ]; then
  WORK="$WIN_TMP/checkit-demo-$$"
  mkdir -p "$WORK"
fi
cleanup() { rm -rf "$WORK" 2>/dev/null || true; }
trap cleanup EXIT

# Always clean prior screenshots so a partial run can't lie about state
rm -f "$OUT_DIR"/*.txt 2>/dev/null || true

# Translate MSYS /c/... paths to C:\... so pnpm (a Windows process) can
# open them. Without this `pnpm add -D /d/dev/checkit/...tgz` becomes
# `pnpm add -D C:\d\dev\checkit\...tgz` which doesn't exist.
# Git Bash convention: /d/foo is D:/foo, not D:/d/foo.
# Drive letter must be uppercase — pnpm on Windows rejects lowercase.
to_win_path() {
  case "$1" in
    /[a-zA-Z]/*) printf '%s' "$1" | sed -E 's|^/([a-zA-Z])/|\U\1:\\|' ;;
    *) printf '%s' "$1" ;;
  esac
}
TGZ="$(to_win_path "$TGZ")"

if [ ! -f "$TGZ" ]; then
  echo "Building @checkit/cli tarball..." >&2
  (cd "$REPO_ROOT/packages/backend" && pnpm build >/dev/null 2>&1 && pnpm pack >/dev/null 2>&1)
fi

# ─────────────────────────────────────────────────────────────────────────
# 01 quickstart
# ─────────────────────────────────────────────────────────────────────────
if $SHOULD_RUN_01; then
  echo "[demo] 01 quickstart" >&2
  rm -rf "$WORK/01" && mkdir -p "$WORK/01/src"
  cd "$WORK/01"
  cp "$REPO_ROOT/examples/01-quickstart/package.json" .
  cp "$REPO_ROOT/examples/01-quickstart/checkit.config.ts" .
  cp "$REPO_ROOT/examples/01-quickstart/src/main.ts" src/
  # Strip the devDeps that point at the un-published @checkit/cli —
  # otherwise pnpm tries to fetch from the npm registry and fails.
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    delete p.devDependencies;
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  pnpm add -D "$TGZ" 2>&1 | tail -3 || true
  {
    echo '$ cd examples/01-quickstart'
    echo '$ pnpm add -D @checkit/cli'
    echo '$ pnpm exec checkit'
    pnpm --silent exec checkit 2>&1 || true
  } > "$OUT_DIR/01-review.txt"
fi

# ─────────────────────────────────────────────────────────────────────────
# 02 custom rule
# ─────────────────────────────────────────────────────────────────────────
if $SHOULD_RUN_02; then
  echo "[demo] 02 custom rule" >&2
  rm -rf "$WORK/02" && mkdir -p "$WORK/02/.checkit/rules" "$WORK/02/src"
  cd "$WORK/02"
  cp "$REPO_ROOT/examples/02-custom-rule/package.json" .
  cp "$REPO_ROOT/examples/02-custom-rule/checkit.config.ts" .
  cp "$REPO_ROOT/examples/02-custom-rule/src/users.ts" src/
  cp "$REPO_ROOT/examples/02-custom-rule/.checkit/rules/no-lodash.ts" .checkit/rules/
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    delete p.devDependencies;
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  pnpm add -D "$TGZ" 2>&1 | tail -3 || true
  {
    echo '$ cd examples/02-custom-rule'
    echo '$ pnpm add -D @checkit/cli'
    echo '$ pnpm exec checkit'
    pnpm --silent exec checkit 2>&1 || true
  } > "$OUT_DIR/02-review.txt"
fi

# ─────────────────────────────────────────────────────────────────────────
# 03 AI-Fix
# ─────────────────────────────────────────────────────────────────────────
if $SHOULD_RUN_03; then
  echo "[demo] 03 AI-Fix" >&2
  rm -rf "$WORK/03" && mkdir -p "$WORK/03/src"
  cd "$WORK/03"
  cp "$REPO_ROOT/examples/03-ai-fix/package.json" .
  cp "$REPO_ROOT/examples/03-ai-fix/checkit.config.ts" .
  cp "$REPO_ROOT/examples/03-ai-fix/src/main.ts" src/
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    delete p.devDependencies;
    fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n');
  "
  pnpm add -D "$TGZ" 2>&1 | tail -3 || true

  {
    echo '$ cd examples/03-ai-fix'
    echo '$ pnpm add -D @checkit/cli'
    echo '$ pnpm exec checkit'
    pnpm --silent exec checkit 2>&1 || true
  } > "$OUT_DIR/03-review.txt"

  # AI-Fix summary — pipe to head so we don't hang on agent runtime
  {
    echo '$ pnpm exec checkit --ai-fix'
    timeout 60 pnpm --silent exec checkit --ai-fix 2>&1 | head -10 || echo "(ai-fix timed out — install opencode / claude to run for real)"
  } > "$OUT_DIR/03-ai-fix.txt"
fi

echo "" >&2
echo "Screenshots written to $OUT_DIR:" >&2
ls -la "$OUT_DIR" >&2