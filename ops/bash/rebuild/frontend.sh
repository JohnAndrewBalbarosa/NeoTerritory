#!/usr/bin/env bash
# ops/bash/rebuild/frontend.sh — rebuild the host-side Vite frontend bundle.
#
# Standalone:  ./ops/bash/rebuild/frontend.sh
# Orchestrated: called by scripts/rebuild.sh and start.sh --rebuild=...
#
# Note: the Docker runtime image builds its own frontend stage from source.
# This script is for host-side dev/preview where Codebase/Frontend/dist/ is
# served directly. Run the docker rebuild separately when the container
# layout changes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT/Codebase/Frontend"

if [[ ! -d node_modules ]]; then
  echo "[rebuild:frontend] node_modules missing — running npm ci"
  npm ci
fi

echo "[rebuild:frontend] running npm run build"
npm run build

if [[ -d dist && -f dist/index.html ]]; then
  echo "[rebuild:frontend] dist ready at Codebase/Frontend/dist/"
else
  echo "[rebuild:frontend] ERROR: dist/index.html missing after build" >&2
  exit 1
fi
