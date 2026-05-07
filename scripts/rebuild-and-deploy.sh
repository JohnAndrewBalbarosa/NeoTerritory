#!/usr/bin/env bash
# Full rebuild + redeploy cycle:
#   1. C++ microservice (cmake build-wsl)
#   2. Docker image (Dockerfile under Codebase/Infrastructure/session-orchestration/docker/)
#   3. Container restart on port 3001 with stale-process cleanup
#   4. Health check
#
# Run inside WSL Ubuntu, or invoke from Windows PowerShell via:
#   wsl -d Ubuntu -- bash -c "/mnt/c/Users/Drew/Desktop/NeoTerritory/scripts/rebuild-and-deploy.sh"
#
# Flags:
#   --skip-cpp     Skip the cmake build (use existing binary)
#   --skip-docker  Skip the docker build (just restart with current image)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SKIP_CPP=0
SKIP_DOCKER=0
for arg in "$@"; do
  case "$arg" in
    --skip-cpp)    SKIP_CPP=1 ;;
    --skip-docker) SKIP_DOCKER=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "[rebuild-and-deploy] unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$SKIP_CPP" -eq 0 ]]; then
  echo "[rebuild-and-deploy] step 1/4: building C++ microservice"
  cmake --build Codebase/Microservice/build-wsl 2>&1 | tail -15
else
  echo "[rebuild-and-deploy] step 1/4: SKIPPED (--skip-cpp)"
fi

if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  echo "[rebuild-and-deploy] step 2/4: building Docker image"
  docker build -t neoterritory:latest \
    -f Codebase/Infrastructure/session-orchestration/docker/Dockerfile . 2>&1 | tail -8
else
  echo "[rebuild-and-deploy] step 2/4: SKIPPED (--skip-docker)"
fi

echo "[rebuild-and-deploy] step 3/4: restarting container on port 3001"
docker rm -f neoterritory 2>/dev/null || true
STALE=$(lsof -ti :3001 2>/dev/null || true)
if [[ -n "$STALE" ]]; then
  echo "[rebuild-and-deploy]   killing stale process on :3001 (pid=$STALE)"
  kill -9 $STALE 2>/dev/null || true
  sleep 1
fi
docker run -d --name neoterritory -p 3001:3001 neoterritory:latest >/dev/null
sleep 4
docker ps --filter name=neoterritory --format "  {{.Names}}  {{.Status}}  {{.Ports}}"

echo "[rebuild-and-deploy] step 4/4: health check"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[rebuild-and-deploy]   /api/health → 200 OK"
else
  echo "[rebuild-and-deploy]   /api/health → $HTTP_CODE (NOT OK)"
  echo "[rebuild-and-deploy]   recent container logs:"
  docker logs --tail 20 neoterritory
  exit 1
fi

echo "[rebuild-and-deploy] done."
