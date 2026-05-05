#!/usr/bin/env bash
# Shared build/install helpers used by dev + setup subcommands.

_detect_node_platform_tag() {
  # Echoes "<os>-<arch>" matching @esbuild/* and @rollup/* native subpackages.
  local os='' arch=''
  case "$(uname -s)" in
    Linux*)               os=linux ;;
    Darwin*)              os=darwin ;;
    MINGW*|MSYS*|CYGWIN*) os=win32 ;;
    *)                    return 0 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)         arch=x64 ;;
    aarch64|arm64)        arch=arm64 ;;
    *)                    return 0 ;;
  esac
  printf '%s-%s' "$os" "$arch"
}

_node_modules_platform_ok() {
  # Returns 0 if node_modules looks valid for current platform, 1 if mismatch.
  # Anchored on esbuild because that's where cross-platform copies blow up
  # first; same logic catches rollup native binaries when present.
  local dir="$1" plat
  plat="$(_detect_node_platform_tag)"
  [[ -z "$plat" ]] && return 0
  if [[ -d "$dir/node_modules/esbuild" && ! -d "$dir/node_modules/@esbuild/$plat" ]]; then
    return 1
  fi
  if [[ -d "$dir/node_modules/rollup" ]]; then
    if compgen -G "$dir/node_modules/@rollup/rollup-*" > /dev/null; then
      if ! compgen -G "$dir/node_modules/@rollup/rollup-${plat}*" > /dev/null; then
        return 1
      fi
    fi
  fi
  return 0
}

ensure_node_modules() {
  local dir="$1" label="$2"
  if [[ -d "$dir/node_modules" ]]; then
    if _node_modules_platform_ok "$dir"; then
      ok "$label node_modules already present."
      return
    fi
    warn "$label node_modules built for a different platform — reinstalling for $(uname -s -m)."
    rm -rf "$dir/node_modules"
  fi
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
