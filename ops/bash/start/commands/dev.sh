#!/usr/bin/env bash
# `start.sh dev` (and `prod`) — local development server stack.

invoke_dev() {
  # shellcheck source=../../verify-requirements.sh
  source "$ROOT_DIR/scripts/verify-requirements.sh"
  local req_profile='pods'
  local req_soft=''
  [[ "$SKIP_POD" -eq 1 ]] && req_profile='dev'
  [[ "$SKIP_POD" -eq 0 ]] && req_soft='soft'
  if ! verify_requirements "$req_profile" "$req_soft" "auto"; then
    err 'Aborting — requirements not met.'; exit 1
  fi

  local bind advert
  bind="$(resolve_bind_host)"
  advert="$(resolve_advertise_host)"

  if [[ "$LAN" -eq 1 ]] && is_wsl2; then
    warn 'Running --lan inside WSL2: WSL2 eth0 is NOT reachable from your LAN.'
    warn '  Run .\start.ps1 -Lan from Windows PowerShell instead, or configure netsh portproxy.'
  fi

  # Rebuilds are opt-in via --rebuild=<list>. Run them BEFORE the verify
  # step so a fresh binary/dist is what gets verified.
  if [[ -n "$REBUILD_LIST" ]]; then
    step "Running requested rebuilds: $REBUILD_LIST"
    run_rebuild_list "$REBUILD_LIST"
  fi

  ensure_pod_image
  ensure_node_modules "$BACKEND_DIR" 'Backend'
  [[ "$BACKEND_ONLY" -eq 0 ]] && ensure_node_modules "$FRONTEND_DIR" 'Frontend'
  write_dev_env "$BACKEND_PORT" "$FRONTEND_PORT" "$advert"

  # Verify-only by default. The microservice binary must already exist —
  # start.sh no longer auto-builds C++. If it's missing, fail fast with the
  # exact rebuild commands instead of silently triggering a long cmake.
  step 'Verifying microservice binary'
  if ! verify_microservice_binary; then exit 1; fi

  if [[ "$PROD" -eq 1 && "$SKIP_BUILD" -eq 0 ]]; then
    step 'Building Backend (npm run build)'
    ( cd "$BACKEND_DIR" && npm run build )
    ok 'Backend build complete.'
    if [[ "$BACKEND_ONLY" -eq 0 ]]; then
      step 'Building Frontend (npm run build)'
      ( cd "$FRONTEND_DIR" && npm run build )
      ok 'Frontend build complete.'
    fi
  fi

  # Probe (or auto-free) the dev ports before binding. Without this, a
  # stale tsx-watch / Vite from a prior session — or the long-running
  # neoterritory Docker container that publishes :3001 — silently
  # collides with the new backend, leading to confusing health-check
  # failures or two listeners on the same port. See lib/ports.sh.
  ensure_port_free "$BACKEND_PORT"  backend
  [[ "$BACKEND_ONLY" -eq 0 ]] && ensure_port_free "$FRONTEND_PORT" vite

  start_backend "$bind" "$advert"
  start_vite    "$bind"
  install_cleanup_trap

  print_studio_urls "$advert"

  if [[ "$NO_BROWSER" -eq 0 ]]; then
    step 'Launching clean Chromium'
    URL_ARG="$(studio_open_url "$advert")" invoke_browser_inline &
  fi

  echo 'Ctrl+C stops the backend, Vite, and the browser.'
  tail -F "$BACKEND_DIR/server.out.log"
}

ensure_pod_image() {
  [[ "$SKIP_POD" -eq 1 ]] && return 0
  step 'Checking Docker pod image'
  if ! has docker; then
    warn 'docker not on PATH — pod isolation skipped; backend uses local sandbox.'
    return 0
  fi
  if docker image inspect "$POD_IMAGE" >/dev/null 2>&1; then
    ok "$POD_IMAGE already built."; return 0
  fi
  if [[ ! -f "$DOCKERFILE" ]]; then
    warn "Dockerfile not found at $DOCKERFILE — pod isolation unavailable."; return 0
  fi
  step "Building $POD_IMAGE from $DOCKERFILE"
  if docker build -f "$DOCKERFILE" -t "$POD_IMAGE" "$(dirname "$DOCKERFILE")"; then
    ok "$POD_IMAGE ready."
  else
    warn 'docker build failed — falling back to local sandbox.'
  fi
}

start_backend() {
  local bind="$1" advert="$2"
  local backend_cmd='npm run dev'
  [[ "$PROD" -eq 1 ]] && backend_cmd='npm run start'

  step "Starting backend (bind=$bind, port=$BACKEND_PORT, mode=$([[ "$PROD" -eq 1 ]] && echo prod || echo dev))"
  local backend_env=(
    PORT="$BACKEND_PORT"
    HOST="$bind"
    TMPDIR=/tmp TMP=/tmp TEMP=/tmp
  )
  if [[ "$LAN" -eq 1 && "$advert" != 'localhost' ]]; then
    backend_env+=(CORS_ORIGIN="http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://$advert:$BACKEND_PORT,http://$advert:$FRONTEND_PORT")
  fi
  # tsx unix-socket workaround: force linux TMPDIR.
  env "${backend_env[@]}" bash -c "cd '$BACKEND_DIR' && $backend_cmd" \
    >"$BACKEND_DIR/server.out.log" 2>"$BACKEND_DIR/server.err.log" &
  BACKEND_PID=$!
  step "Backend started (pid $BACKEND_PID)"

  local tries=240
  if ! wait_url "http://127.0.0.1:$BACKEND_PORT/api/health" "$tries"; then
    err "Backend did not become healthy within $((tries / 2))s. Last lines of server.err.log:"
    [[ -f "$BACKEND_DIR/server.err.log" ]] && tail -30 "$BACKEND_DIR/server.err.log" || true
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi
  ok 'Backend healthy.'
}

start_vite() {
  local bind="$1"
  VITE_PID=''
  [[ "$BACKEND_ONLY" -eq 1 ]] && return 0

  local vite_label='Vite dev server' vite_script='dev'
  if [[ "$PROD" -eq 1 ]]; then vite_label='Vite preview'; vite_script='preview'; fi

  step "Starting $vite_label (bind=$bind, port=$FRONTEND_PORT)"
  local vite_host_args=''
  if [[ "$LAN" -eq 1 || "$bind" == '0.0.0.0' ]]; then vite_host_args='--host 0.0.0.0'
  elif [[ -n "$BIND_HOST" ]]; then vite_host_args="--host $BIND_HOST"
  fi
  env VITE_HOST="$bind" TMPDIR=/tmp TMP=/tmp TEMP=/tmp \
    bash -c "cd '$FRONTEND_DIR' && npm run $vite_script -- --port $FRONTEND_PORT --strictPort $vite_host_args" \
    >"$FRONTEND_DIR/vite.out.log" 2>"$FRONTEND_DIR/vite.err.log" &
  VITE_PID=$!
  step "Vite started (pid $VITE_PID)"
  if ! wait_url "http://127.0.0.1:$FRONTEND_PORT/" 60; then
    err 'Vite did not start within 30s.'
    [[ -f "$FRONTEND_DIR/vite.err.log" ]] && tail -30 "$FRONTEND_DIR/vite.err.log" || true
    kill "$BACKEND_PID" "$VITE_PID" 2>/dev/null || true
    exit 1
  fi
  ok 'Vite ready.'
}

install_cleanup_trap() {
  cleanup() {
    step 'Shutting down'
    [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "${VITE_PID:-}"    ]] && kill "$VITE_PID"    2>/dev/null || true
    ok 'Stopped.'
  }
  trap cleanup EXIT INT TERM
}

studio_port() {
  if [[ "$BACKEND_ONLY" -eq 1 ]]; then echo "$BACKEND_PORT"; else echo "$FRONTEND_PORT"; fi
}

studio_open_url() {
  local advert="$1" port; port="$(studio_port)"
  if [[ "$advert" != 'localhost' ]]; then echo "http://$advert:$port"
  else echo "http://localhost:$port"
  fi
}

print_studio_urls() {
  local advert="$1" port; port="$(studio_port)"
  local local_url="http://localhost:$port"
  local lan_url=''
  [[ "$advert" != 'localhost' ]] && lan_url="http://$advert:$port"
  echo
  echo "  Studio:        $local_url"
  [[ -n "$lan_url" ]] && echo "  Studio (LAN):  $lan_url"
  echo "  Backend API:   http://localhost:$BACKEND_PORT"
  echo "  Health:        http://localhost:$BACKEND_PORT/api/health"
  echo
}
