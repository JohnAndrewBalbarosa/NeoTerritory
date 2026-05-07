#!/usr/bin/env bash
# scripts/rebuild.sh — canonical local rebuild orchestrator for NeoTerritory.
#
# Thin shim. Each layer has its own per-component script under
# ops/bash/rebuild/, and this file just decides which ones to invoke.
#
# Default (no flags): rebuild the C++ microservice and the Docker image,
# then restart the runtime container on :3001. The host-side frontend
# (Vite) and backend (tsc) scripts are NOT run by default because the
# Docker image rebuilds them internally — they exist for dev/preview
# workflows where the host bundle is what gets served.
#
# Two equivalent flag styles are accepted:
#   1. Inclusion list (NEW):
#        --rebuild=<list>     csv of {microservice,frontend,backend,docker,all}
#        --rebuild=all        run all four scripts
#        --rebuild=docker     docker only
#        --rebuild=microservice,docker  ← same as bare default
#   2. Exclusion flags (LEGACY — preserves CLAUDE.md hard-rule wording):
#        --skip-microservice  skip the cmake step
#        --skip-frontend      no-op (kept for legacy callers; host fe is
#                             opt-in via --rebuild=frontend)
#        --skip-backend       no-op (same reasoning)
#        --skip-docker        skip image build + container restart
#
#   --mode-a                  after rebuild, hand off to start.sh --local
#                             (hot reload). Implies --skip-docker.
#   -h | --help               show this help
#
# Per-component scripts can also be invoked directly:
#   ./ops/bash/rebuild/microservice.sh
#   ./ops/bash/rebuild/frontend.sh
#   ./ops/bash/rebuild/backend.sh
#   ./ops/bash/rebuild/docker.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
REBUILD_DIR="$REPO_ROOT/ops/bash/rebuild"

# Bare defaults match the legacy contract: micro + docker on, host fe/be off.
DO_MICRO=1
DO_FRONT=0
DO_BACK=0
DO_DOCKER=1
MODE_A=0
EXPLICIT_LIST=0

print_help() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; }

apply_inclusion_list() {
  local list="$1"
  DO_MICRO=0; DO_FRONT=0; DO_BACK=0; DO_DOCKER=0
  EXPLICIT_LIST=1
  IFS=',' read -ra parts <<< "$list"
  for p in "${parts[@]}"; do
    case "$p" in
      all)          DO_MICRO=1; DO_FRONT=1; DO_BACK=1; DO_DOCKER=1 ;;
      microservice) DO_MICRO=1 ;;
      frontend)     DO_FRONT=1 ;;
      backend)      DO_BACK=1 ;;
      docker)       DO_DOCKER=1 ;;
      '') ;;
      *) echo "[rebuild.sh] unknown component in --rebuild=: '$p'" >&2; exit 2 ;;
    esac
  done
}

for arg in "$@"; do
  case "$arg" in
    --rebuild=*)         apply_inclusion_list "${arg#--rebuild=}" ;;
    --skip-microservice) DO_MICRO=0 ;;
    --skip-frontend)     : ;;  # legacy no-op (host fe is opt-in)
    --skip-backend)      : ;;  # legacy no-op (host be is opt-in)
    --skip-docker)       DO_DOCKER=0 ;;
    --mode-a)            MODE_A=1 ;;
    -h|--help)           print_help; exit 0 ;;
    *) echo "[rebuild.sh] unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

if [[ "$MODE_A" -eq 1 ]]; then
  # Mode A means hot-reload local dev — by definition no Docker container.
  DO_DOCKER=0
fi

ts()     { date '+%H:%M:%S'; }
banner() { echo; echo "[rebuild.sh $(ts)] $*"; }

run_step() {
  local label="$1" script="$2"
  banner "step: $label → ops/bash/rebuild/$script"
  bash "$REBUILD_DIR/$script"
}

[[ "$DO_MICRO"  -eq 1 ]] && run_step "microservice" "microservice.sh" || banner "skip: microservice"
[[ "$DO_FRONT"  -eq 1 ]] && run_step "frontend (host)" "frontend.sh"
[[ "$DO_BACK"   -eq 1 ]] && run_step "backend (host)"  "backend.sh"
[[ "$DO_DOCKER" -eq 1 ]] && run_step "docker"        "docker.sh" || banner "skip: docker"

if [[ "$MODE_A" -eq 1 ]]; then
  banner "Mode A: handing off to start.sh --local (hot reload)"
  exec "$REPO_ROOT/start.sh" --local
fi

banner "done."
