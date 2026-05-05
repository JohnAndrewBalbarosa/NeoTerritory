#!/usr/bin/env bash
# `start.sh setup` — first-time provisioning.

invoke_setup() {
  cd "$ROOT_DIR"
  if [[ -f "$ROOT_DIR/scripts/verify-requirements.sh" ]]; then
    # shellcheck source=../../verify-requirements.sh
    source "$ROOT_DIR/scripts/verify-requirements.sh"
    verify_requirements dev "" "auto" || true
  fi

  step "Setup mode: $MODE"

  step 'Phase 2: Backend npm install'
  ( cd "$BACKEND_DIR" && npm install )
  ok 'Backend dependencies installed.'
  step 'Phase 2b: Frontend npm install'
  ( cd "$FRONTEND_DIR" && npm install )
  ok 'Frontend dependencies installed.'

  [[ "$SKIP_MICRO" -eq 0 ]] && build_microservice 0

  setup_write_env
  setup_warmup_db

  echo
  step 'Setup complete'
  ok "Run dev with:  ./start.sh$([[ "$LAN" -eq 1 ]] && echo ' --lan' || true)"

  if [[ "$AUTO_START" -eq 1 ]]; then
    step 'Starting dev server (--auto-start)'
    local args=(dev --backend-port "$BACKEND_PORT" --frontend-port "$FRONTEND_PORT")
    [[ "$LAN" -eq 1 ]] && args+=(--lan)
    [[ -n "$BIND_HOST" ]] && args+=(--host "$BIND_HOST")
    exec "$ROOT_DIR/start.sh" "${args[@]}"
  fi
}

setup_write_env() {
  step 'Phase 4: Backend .env configuration'
  local advert; advert="$(resolve_advertise_host)"
  local cors="http://localhost:$BACKEND_PORT"
  [[ "$advert" != 'localhost' ]] && cors="$cors,http://$advert:$BACKEND_PORT,http://$advert:$FRONTEND_PORT"
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
    warn 'Existing .env backed up.'
  fi
  {
    echo "PORT=$BACKEND_PORT"
    echo "CORS_ORIGIN=$cors"
    echo 'DB_PATH=./src/db/database.sqlite'
    echo
    echo '# Anthropic Claude integration.'
    if [[ -n "$ANTHROPIC_KEY" ]]; then
      echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY"
      echo "ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    else
      echo '# ANTHROPIC_API_KEY=sk-ant-...'
      echo "# ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    fi
    echo
    echo '# Microservice integration.'
    echo "NEOTERRITORY_BIN=$BIN_PATH"
    echo "NEOTERRITORY_CATALOG=$MS_DIR/pattern_catalog"
  } >"$ENV_FILE"
  ok ".env written at $ENV_FILE (lan=$([[ "$advert" != 'localhost' ]] && echo true || echo false))"
}

setup_warmup_db() {
  [[ "$MODE" == 'full' ]] || return 0
  step 'Phase 5: Database warm-up'
  ( cd "$BACKEND_DIR" && node -e "const { initDb } = require('./src/db/initDb'); initDb(); console.log('schema initialized');" )
  ok 'Database schema initialized.'
}
