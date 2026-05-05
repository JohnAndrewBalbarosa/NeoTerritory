#!/usr/bin/env bash
# Shared build/install helpers used by dev + setup subcommands.

ensure_node_modules() {
  local dir="$1" label="$2"
  if [[ -d "$dir/node_modules" ]]; then ok "$label node_modules already present."; return; fi
  step "Installing $label npm dependencies"
  ( cd "$dir" && npm install )
  ok "$label node_modules installed."
}

build_microservice() {
  local force="${1:-0}"
  if [[ "$force" -eq 0 && -f "$BIN_PATH" ]]; then
    ok "Microservice binary already built: $BIN_PATH"
    return
  fi
  step "Building microservice (CMake → $MS_BUILD_DIR)"
  ( cd "$MS_DIR" && cmake -S . -B "$MS_BUILD_DIR" && cmake --build "$MS_BUILD_DIR" --parallel )
  ok "Microservice built: $BIN_PATH"
}

write_dev_env() {
  local port="$1" vite_port="$2" advert="$3"
  if [[ -f "$ENV_FILE" ]]; then ok '.env already exists — leaving in place.'; return; fi
  step 'Creating Backend/.env with defaults'
  local cors="http://localhost:$port,http://localhost:$vite_port"
  [[ "$advert" != 'localhost' ]] && cors="$cors,http://$advert:$port,http://$advert:$vite_port"
  cat >"$ENV_FILE" <<EOF
PORT=$port
CORS_ORIGIN=$cors
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration. Leave unset to run microservice-only mode.
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration. Defaults derived from project layout.
# NEOTERRITORY_BIN=$BIN_PATH
# NEOTERRITORY_CATALOG=$MS_DIR/pattern_catalog
EOF
  ok ".env created at $ENV_FILE"
}
