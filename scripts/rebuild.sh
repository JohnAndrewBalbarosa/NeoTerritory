#!/usr/bin/env bash
# scripts/rebuild.sh — canonical local rebuild entry for NeoTerritory.
#
# Default (no flags): rebuild ALL four layers and run locally on :3001 via
# Docker. No AWS push, no remote calls. Designed so a single command brings a
# clean checkout up to a working localhost stack.
#
# Flags are EXCLUSIONS — anything you pass is what gets skipped:
#   --skip-microservice   skip cmake build of the C++ microservice
#   --skip-frontend       trust docker layer cache for the Vite frontend layer
#   --skip-backend        trust docker layer cache for the backend tsc layer
#   --skip-docker         skip image build + container restart entirely
#   --mode-a              after rebuild, hand off to start.sh --local
#                         (hot reload). Mutually exclusive with --skip-docker.
#   -h | --help           show this help
#
# Each rebuilt layer prints a before/after sha256. If the hash is unchanged
# after a "rebuild" step you'll see:
#   [rebuild.sh] WARN: <layer> hash unchanged — build may have been a no-op
# That's the canary for "did anything actually rebuild?"
#
# Examples:
#   ./scripts/rebuild.sh                              # full local rebuild
#   ./scripts/rebuild.sh --skip-microservice          # docker only
#   ./scripts/rebuild.sh --skip-frontend --skip-backend  # cpp + image (cached app layers)
#   ./scripts/rebuild.sh --skip-docker                # cpp build only
#   ./scripts/rebuild.sh --mode-a                     # rebuild then hot-reload

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SKIP_MICRO=0
SKIP_FRONT=0
SKIP_BACK=0
SKIP_DOCKER=0
MODE_A=0

print_help() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; }

for arg in "$@"; do
  case "$arg" in
    --skip-microservice) SKIP_MICRO=1 ;;
    --skip-frontend)     SKIP_FRONT=1 ;;
    --skip-backend)      SKIP_BACK=1 ;;
    --skip-docker)       SKIP_DOCKER=1 ;;
    --mode-a)            MODE_A=1 ;;
    -h|--help)           print_help; exit 0 ;;
    *) echo "[rebuild.sh] unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

if [[ "$MODE_A" -eq 1 && "$SKIP_DOCKER" -eq 0 ]]; then
  # Mode A means hot-reload local dev — by definition no Docker container.
  SKIP_DOCKER=1
fi

ts()    { date '+%H:%M:%S'; }
banner() { echo; echo "[rebuild.sh $(ts)] $*"; }
warn()   { echo "[rebuild.sh] WARN: $*" >&2; }

hash_file() {
  if [[ -f "$1" ]]; then sha256sum "$1" | awk '{print substr($1,1,12)}'; else echo "absent"; fi
}
hash_image() {
  docker image inspect "$1" --format '{{.Id}}' 2>/dev/null | sed 's/sha256://; s/\(............\).*/\1/' || echo absent
}

BIN_PATH="Codebase/Microservice/build-wsl/NeoTerritory"
IMAGE_TAG="neoterritory:latest"

# ---------- Step 1: C++ microservice ----------
if [[ "$SKIP_MICRO" -eq 0 ]]; then
  banner "step 1/4: C++ microservice (cmake --build)"
  BEFORE=$(hash_file "$BIN_PATH")
  echo "[rebuild.sh]   before sha: $BEFORE"
  cmake --build Codebase/Microservice/build-wsl 2>&1 | tail -20
  AFTER=$(hash_file "$BIN_PATH")
  echo "[rebuild.sh]   after  sha: $AFTER"
  if [[ "$BEFORE" == "$AFTER" && "$AFTER" != "absent" ]]; then
    warn "microservice hash unchanged — no .cpp/.hpp/.cmake change since last build"
  fi
else
  banner "step 1/4: SKIPPED (--skip-microservice)"
fi

# ---------- Step 2: Docker image ----------
if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  banner "step 2/4: Docker image $IMAGE_TAG"
  BEFORE_IMG=$(hash_image "$IMAGE_TAG")
  echo "[rebuild.sh]   before image: $BEFORE_IMG"
  if [[ "$SKIP_FRONT" -eq 1 ]]; then
    echo "[rebuild.sh]   --skip-frontend: relying on Docker layer cache for frontend stage"
  fi
  if [[ "$SKIP_BACK" -eq 1 ]]; then
    echo "[rebuild.sh]   --skip-backend: relying on Docker layer cache for backend stage"
  fi
  docker build -t "$IMAGE_TAG" \
    -f Codebase/Infrastructure/session-orchestration/docker/Dockerfile . 2>&1 | tail -12
  AFTER_IMG=$(hash_image "$IMAGE_TAG")
  echo "[rebuild.sh]   after  image: $AFTER_IMG"
  if [[ "$BEFORE_IMG" == "$AFTER_IMG" && "$AFTER_IMG" != "absent" ]]; then
    warn "docker image hash unchanged — every layer was a cache hit"
  fi
else
  banner "step 2/4: SKIPPED (--skip-docker)"
fi

# ---------- Step 3: container restart ----------
if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  banner "step 3/4: restarting container on :3001"
  docker rm -f neoterritory 2>/dev/null || true
  STALE=$(lsof -ti :3001 2>/dev/null || true)
  if [[ -n "$STALE" ]]; then
    echo "[rebuild.sh]   killing stale process on :3001 (pid=$STALE)"
    kill -9 $STALE 2>/dev/null || true
    sleep 1
  fi
  docker run -d --name neoterritory -p 3001:3001 "$IMAGE_TAG" >/dev/null
  sleep 4
  docker ps --filter name=neoterritory --format "  {{.Names}}  {{.Status}}  {{.Ports}}"
else
  banner "step 3/4: SKIPPED (--skip-docker)"
fi

# ---------- Step 4: health check OR Mode A handoff ----------
if [[ "$MODE_A" -eq 1 ]]; then
  banner "step 4/4: handing off to start.sh --local (Mode A hot reload)"
  exec "$REPO_ROOT/start.sh" --local
fi

if [[ "$SKIP_DOCKER" -eq 0 ]]; then
  banner "step 4/4: health check /api/health"
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    echo "[rebuild.sh]   /api/health → 200 OK"
  else
    echo "[rebuild.sh]   /api/health → $HTTP_CODE (NOT OK)"
    echo "[rebuild.sh]   recent container logs:"
    docker logs --tail 20 neoterritory || true
    exit 1
  fi
else
  banner "step 4/4: SKIPPED (--skip-docker — no container to probe)"
fi

banner "done."
