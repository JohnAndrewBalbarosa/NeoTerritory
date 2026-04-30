#!/usr/bin/env bash
# Root orchestrator — provisions the whole NeoTerritory stack on one WSL device.
# Each component also has its own setup.sh you can run standalone on a
# dedicated device. Flags let you skip components selectively.
#
# Usage:
#   ./bootstrap.sh                 # all components
#   ./bootstrap.sh --no-infra      # skip Docker/k8s
#   ./bootstrap.sh --only backend  # backend only
#   ./bootstrap.sh --help
#
# Note: legacy deploy/run scripts moved to ./scripts/ (deploy-minikube.sh,
# deploy.ps1, run-dev.ps1, setup.ps1, test.sh). This bootstrap.sh is the
# canonical entrypoint for first-time provisioning.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DO_FRONTEND=1; DO_BACKEND=1; DO_MICRO=1; DO_INFRA=1
ONLY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-frontend)     DO_FRONTEND=0 ;;
    --no-backend)      DO_BACKEND=0 ;;
    --no-microservice) DO_MICRO=0 ;;
    --no-infra)        DO_INFRA=0 ;;
    --only)            shift; ONLY="${1:-}" ;;
    -h|--help)
      sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -n "$ONLY" ]; then
  DO_FRONTEND=0; DO_BACKEND=0; DO_MICRO=0; DO_INFRA=0
  case "$ONLY" in
    frontend)     DO_FRONTEND=1 ;;
    backend)      DO_BACKEND=1 ;;
    microservice) DO_MICRO=1 ;;
    infra)        DO_INFRA=1 ;;
    *) echo "--only must be one of: frontend|backend|microservice|infra" >&2; exit 2 ;;
  esac
fi

banner() { printf "\n\033[1;37m=== %s ===\033[0m\n" "$*"; }

chmod +x Codebase/Frontend/setup.sh \
         Codebase/Backend/setup.sh \
         Codebase/Microservice/setup.sh \
         Codebase/Infrastructure/setup.sh 2>/dev/null || true

[ "$DO_BACKEND"  = 1 ] && { banner "Backend";       bash Codebase/Backend/setup.sh; }
[ "$DO_FRONTEND" = 1 ] && { banner "Frontend";      bash Codebase/Frontend/setup.sh; }
[ "$DO_MICRO"    = 1 ] && { banner "Microservice";  bash Codebase/Microservice/setup.sh || echo "(microservice optional — continuing)"; }
[ "$DO_INFRA"    = 1 ] && { banner "Infrastructure"; bash Codebase/Infrastructure/setup.sh || echo "(infra optional — continuing)"; }

banner "Done"
cat <<'EOF'

Single-device dev next steps:
  1. cd Codebase/Backend && node server.js
  2. Open http://localhost:3002  (or PORT from Codebase/Backend/.env)
  3. Admin login: Neoterritory / ragabag123  -> /admin.html

Per-device deploy:
  Run each component's setup.sh on its own machine.
  Set window.API_BASE in the Frontend host to point at the Backend URL.
EOF
