#!/usr/bin/env bash
# NeoTerritory — one-script run-all (POSIX side).
#
# Pre-builds the per-tester Docker pod image (idempotent), hands off the
# rest of the dev pipeline to bootstrap.sh / package npm scripts, then
# opens a clean Chromium pointed at the studio.
#
# Annotated-source pattern detection still runs through the local C++
# microservice executable; only GDB unit-test EXECUTION routes through
# the per-user pod once a tester signs in.
#
# Usage:
#   ./start.sh
#   ./start.sh --rebuild
#   ./start.sh --backend-only
#   ./start.sh --no-browser
#   ./start.sh --skip-pod
#   BACKEND_PORT=3055 FRONTEND_PORT=5180 ./start.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Codebase/Backend"
FRONTEND_DIR="$ROOT_DIR/Codebase/Frontend"
DOCKERFILE="$BACKEND_DIR/docker/cpp-pod.Dockerfile"
POD_IMAGE="neoterritory/cpp-pod:latest"

REBUILD=0
BACKEND_ONLY=0
NO_BROWSER=0
SKIP_POD=0
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

for arg in "$@"; do
  case "$arg" in
    --rebuild)      REBUILD=1 ;;
    --backend-only) BACKEND_ONLY=1 ;;
    --no-browser)   NO_BROWSER=1 ;;
    --skip-pod)     SKIP_POD=1 ;;
  esac
done

step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    %s\033[0m\n' "$*"; }

# ── 0. Requirements check (STRICT — fail fast on first miss) ────────────────
# NeoTerritory is high-criticality; if a required tool is missing the
# script aborts immediately rather than half-starting in a degraded
# state. Pass --skip-pod to drop docker out of the requirement set when
# you knowingly want to run with the local sandbox fallback.
# shellcheck source=scripts/verify-requirements.sh
source "$ROOT_DIR/scripts/verify-requirements.sh"
REQ_PROFILE='pods'
[[ $SKIP_POD -eq 1 ]] && REQ_PROFILE='dev'
if ! verify_requirements "$REQ_PROFILE"; then
  echo ''
  echo '==> Aborting ./start.sh — requirements not met.'
  exit 1
fi

# ── 1. One-time Docker pod image build ───────────────────────────────────────

if [[ $SKIP_POD -eq 0 ]]; then
  step 'Checking Docker pod image (one-time per host)'
  if ! command -v docker >/dev/null 2>&1; then
    warn 'docker not found on PATH — backend will fall back to local sandbox for GDB unit tests.'
  elif ! docker image inspect "$POD_IMAGE" >/dev/null 2>&1; then
    if [[ -f "$DOCKERFILE" ]]; then
      step "Building $POD_IMAGE from $DOCKERFILE (one-time, ~30-60s)"
      if ! docker build -f "$DOCKERFILE" -t "$POD_IMAGE" "$(dirname "$DOCKERFILE")"; then
        warn 'docker build failed — backend will fall back to local sandbox for GDB unit tests.'
      else
        ok "$POD_IMAGE ready."
      fi
    else
      warn "Dockerfile not found at $DOCKERFILE — pod isolation unavailable."
    fi
  else
    ok "$POD_IMAGE already built."
  fi
fi

# ── 2. Install deps if missing (mirrors run-dev.ps1's gating) ────────────────

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  step 'Installing backend npm dependencies'
  (cd "$BACKEND_DIR" && npm install)
  ok 'Backend node_modules installed.'
else
  ok 'Backend node_modules already present.'
fi

if [[ $BACKEND_ONLY -eq 0 ]]; then
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    step 'Installing frontend npm dependencies'
    (cd "$FRONTEND_DIR" && npm install)
    ok 'Frontend node_modules installed.'
  else
    ok 'Frontend node_modules already present.'
  fi
fi

# ── 3. Microservice build ────────────────────────────────────────────────────

MS_DIR="$ROOT_DIR/Codebase/Microservice"
BIN_NAME="NeoTerritory"
case "${OS:-}" in *Windows*) BIN_NAME="NeoTerritory.exe" ;; esac
BIN_PATH="$MS_DIR/build/$BIN_NAME"

if [[ $REBUILD -eq 1 || ! -f "$BIN_PATH" ]]; then
  step 'Building microservice (CMake)'
  (cd "$MS_DIR" && cmake -S . -B build && cmake --build build)
  ok "Microservice built: $BIN_PATH"
else
  ok "Microservice binary already built: $BIN_PATH"
fi

# ── 4. Start backend + Vite as background jobs ───────────────────────────────

PORT="$BACKEND_PORT" \
  bash -c "cd '$BACKEND_DIR' && npm run dev" \
  >"$BACKEND_DIR/server.out.log" 2>"$BACKEND_DIR/server.err.log" &
BACKEND_PID=$!
step "Backend started (pid $BACKEND_PID, port $BACKEND_PORT)"

VITE_PID=""
if [[ $BACKEND_ONLY -eq 0 ]]; then
  bash -c "cd '$FRONTEND_DIR' && npm run dev -- --port $FRONTEND_PORT --strictPort" \
    >"$FRONTEND_DIR/vite.out.log" 2>"$FRONTEND_DIR/vite.err.log" &
  VITE_PID=$!
  step "Vite started (pid $VITE_PID, port $FRONTEND_PORT)"
fi

cleanup() {
  step 'Shutting down'
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${VITE_PID:-}"    ]] && kill "$VITE_PID"    2>/dev/null || true
  ok 'Stopped.'
}
trap cleanup EXIT INT TERM

# ── 5. Wait for the studio, open clean Chromium ──────────────────────────────

wait_url() {
  local url="$1" tries="${2:-120}"
  for ((i=0; i<tries; i++)); do
    if curl -fsS -m 2 -o /dev/null "$url"; then return 0; fi
    sleep 0.5
  done
  return 1
}

OPEN_URL="http://localhost:$FRONTEND_PORT"
[[ $BACKEND_ONLY -eq 1 ]] && OPEN_URL="http://localhost:$BACKEND_PORT"

step "Waiting for studio at $OPEN_URL"
if wait_url "$OPEN_URL"; then
  ok 'Studio ready.'
else
  warn 'Studio not ready — opening anyway; check the logs for errors.'
fi

if [[ $NO_BROWSER -eq 0 && -x "$ROOT_DIR/clean-browser.sh" ]]; then
  step 'Launching clean Chromium'
  ( "$ROOT_DIR/clean-browser.sh" "$OPEN_URL" & )
fi

echo
echo "  Studio:       $OPEN_URL"
echo "  Backend API:  http://localhost:$BACKEND_PORT"
echo "  Health:       http://localhost:$BACKEND_PORT/api/health"
echo
echo 'Ctrl+C stops the backend, Vite, and the browser.'

# ── 6. Tail backend log until interrupted ────────────────────────────────────

tail -F "$BACKEND_DIR/server.out.log"
