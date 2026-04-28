#!/bin/bash
set -e
npm install
npm run db:push
# Re-point this clone's git hooks at scripts/git-hooks/ so the safe-price
# pre-push gate (Task #172) is active even when contributors first sync.
./scripts/install-git-hooks.sh || true
