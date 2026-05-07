#!/usr/bin/env bash
# Bridge between start.sh's --rebuild=<list> flag and the per-component
# scripts under ops/bash/rebuild/. Sourced by start.sh.

REBUILD_SCRIPTS_DIR="$ROOT_DIR/ops/bash/rebuild"

# Run the rebuild scripts named in $1 (csv of microservice,frontend,backend,docker,all).
# Empty list → no-op.
run_rebuild_list() {
  local list="${1:-}"
  [[ -z "$list" ]] && return 0

  local do_micro=0 do_front=0 do_back=0 do_docker=0
  IFS=',' read -ra parts <<< "$list"
  local p
  for p in "${parts[@]}"; do
    case "$p" in
      all)          do_micro=1; do_front=1; do_back=1; do_docker=1 ;;
      microservice) do_micro=1 ;;
      frontend)     do_front=1 ;;
      backend)      do_back=1 ;;
      docker)       do_docker=1 ;;
      '') ;;
      *) err "Unknown component in --rebuild=: '$p' (expected microservice|frontend|backend|docker|all)"; exit 2 ;;
    esac
  done

  [[ "$do_micro"  -eq 1 ]] && { step "Rebuilding microservice (--rebuild=microservice)"; bash "$REBUILD_SCRIPTS_DIR/microservice.sh"; }
  [[ "$do_front"  -eq 1 ]] && { step "Rebuilding frontend (--rebuild=frontend)";       bash "$REBUILD_SCRIPTS_DIR/frontend.sh"; }
  [[ "$do_back"   -eq 1 ]] && { step "Rebuilding backend (--rebuild=backend)";         bash "$REBUILD_SCRIPTS_DIR/backend.sh"; }
  [[ "$do_docker" -eq 1 ]] && { step "Rebuilding docker (--rebuild=docker)";           bash "$REBUILD_SCRIPTS_DIR/docker.sh"; }
}

# Verify the microservice binary is present without building it. Used by
# start.sh dev/prod so a clean checkout fails fast with a clear next step
# instead of silently triggering a long cmake build.
verify_microservice_binary() {
  if [[ -f "$BIN_PATH" ]]; then
    ok "Microservice binary present: $BIN_PATH"
    return 0
  fi
  err "Microservice binary missing: $BIN_PATH"
  err "  Build it with one of:"
  err "    ./ops/bash/rebuild/microservice.sh"
  err "    ./start.sh --rebuild=microservice"
  err "    ./scripts/rebuild.sh --rebuild=microservice"
  return 1
}
