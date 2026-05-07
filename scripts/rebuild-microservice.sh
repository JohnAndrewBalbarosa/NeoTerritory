#!/usr/bin/env bash
# Rebuilds the C++ microservice only (fast iteration when only C++ changed).
# Run inside WSL Ubuntu, or invoke from Windows via:
#   wsl -d Ubuntu -- bash -c "/mnt/c/Users/Drew/Desktop/NeoTerritory/scripts/rebuild-microservice.sh"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "[rebuild-microservice] cmake --build Codebase/Microservice/build-wsl"
cmake --build Codebase/Microservice/build-wsl 2>&1 | tail -15

echo "[rebuild-microservice] done."
