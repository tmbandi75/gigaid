#!/usr/bin/env bash
# Points this clone's git hooks at scripts/git-hooks/ so the versioned
# hooks (currently just pre-push for the safe-price gates) are active for
# every contributor without requiring husky/lint-staged.
#
# Idempotent — safe to call repeatedly (the post-merge script does).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d ".git" ] && [ ! -f ".git" ]; then
  echo "[install-git-hooks] Not a git working tree — skipping." >&2
  exit 0
fi

CURRENT="$(git config --get core.hooksPath || true)"
if [ "$CURRENT" != "scripts/git-hooks" ]; then
  git config core.hooksPath scripts/git-hooks
  echo "[install-git-hooks] Set core.hooksPath = scripts/git-hooks"
else
  echo "[install-git-hooks] core.hooksPath already scripts/git-hooks"
fi

chmod +x scripts/git-hooks/* 2>/dev/null || true
chmod +x scripts/safe-price-checks.sh 2>/dev/null || true
