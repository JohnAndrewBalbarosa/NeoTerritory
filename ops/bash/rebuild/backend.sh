#!/usr/bin/env bash
# ops/bash/rebuild/backend.sh — rebuild the Express/TypeScript backend.
#
# Standalone:  ./ops/bash/rebuild/backend.sh
# Orchestrated: called by scripts/rebuild.sh and start.sh --rebuild=...
#
# Compiles Codebase/Backend/ via tsc to Codebase/Backend/dist/. Host-side
# build only — the Docker runtime image runs its own tsc pass inside the
# image. Run the docker rebuild separately to refresh the container.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT/Codebase/Backend"

if [[ ! -d node_modules ]]; then
  echo "[rebuild:backend] node_modules missing — running npm ci"
  npm ci --include=dev
fi

echo "[rebuild:backend] running npm run build"
npm run build

if [[ -f dist/server.js ]]; then
  echo "[rebuild:backend] dist ready at Codebase/Backend/dist/server.js"
else
  echo "[rebuild:backend] ERROR: dist/server.js missing after build" >&2
  exit 1
fi
