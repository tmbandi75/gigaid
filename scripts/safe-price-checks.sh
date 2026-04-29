#!/usr/bin/env bash
# Runs both safe-price gates (standalone ESLint + Jest scanner) so the
# pre-push git hook and the CI workflow stay in lockstep with the local
# `safe-price-eslint` / `safe-price-scan` validation workflows.
#
# Exits non-zero if either gate fails. Honors $SKIP_SAFE_PRICE=1 as an
# explicit bypass for the same reasons documented in
# docs/safe-price-rule.md (use sparingly, only when the failure is a known
# false positive being tracked elsewhere).

set -euo pipefail

if [[ "${SKIP_SAFE_PRICE:-}" == "1" ]]; then
  echo "[safe-price] SKIP_SAFE_PRICE=1 — bypassing safe-price checks." >&2
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[safe-price] Running ESLint (eslint.safeprice.config.js)…"
# `reports/` and `exports/` (Task #183) currently only contain JSON / PNG
# artifacts, so the globs may match zero files. `--no-error-on-unmatched-pattern`
# keeps the gate green in that case while still gating any TS / TSX builder
# later added under those roots.
npx eslint \
  --config eslint.safeprice.config.js \
  --no-error-on-unmatched-pattern \
  'client/src/**/*.{ts,tsx}' \
  'server/**/*.{ts,tsx}' \
  'shared/**/*.{ts,tsx}' \
  'reports/**/*.{ts,tsx}' \
  'exports/**/*.{ts,tsx}' \
  'tests/**/*.{ts,tsx}' \
  'e2e/**/*.{ts,tsx}'

echo "[safe-price] Running Jest scanner (noRawPriceTemplates)…"
npx jest \
  --selectProjects lib \
  --testPathPatterns noRawPriceTemplates \
  --colors \
  --no-cache

echo "[safe-price] All safe-price checks passed."
