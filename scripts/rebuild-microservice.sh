#!/usr/bin/env bash
# DEPRECATED SHIM — forwards to scripts/rebuild.sh with the right exclusions
# to mean "C++ build only, don't touch Docker".
#
# Canonical: ./scripts/rebuild.sh --skip-frontend --skip-backend --skip-docker

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "[rebuild-microservice] DEPRECATED: forwarding to scripts/rebuild.sh --skip-frontend --skip-backend --skip-docker" >&2
exec "$REPO_ROOT/scripts/rebuild.sh" --skip-frontend --skip-backend --skip-docker "$@"
