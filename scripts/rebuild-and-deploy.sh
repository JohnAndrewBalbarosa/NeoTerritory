#!/usr/bin/env bash
# DEPRECATED SHIM — forwards to scripts/rebuild.sh.
#
# The canonical rebuild entry is now scripts/rebuild.sh (or `./start.sh rebuild`).
# Flag mapping kept for backwards compatibility:
#   --skip-cpp     → --skip-microservice
#   --skip-docker  → --skip-docker (unchanged)
#
# This shim will eventually be removed. New code should call scripts/rebuild.sh
# directly.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mapped=()
for arg in "$@"; do
  case "$arg" in
    --skip-cpp)    mapped+=(--skip-microservice) ;;
    --skip-docker) mapped+=(--skip-docker) ;;
    -h|--help)     mapped+=(--help) ;;
    *)             mapped+=("$arg") ;;
  esac
done

echo "[rebuild-and-deploy] DEPRECATED: forwarding to scripts/rebuild.sh ${mapped[*]:-}" >&2
exec "$REPO_ROOT/scripts/rebuild.sh" "${mapped[@]}"
