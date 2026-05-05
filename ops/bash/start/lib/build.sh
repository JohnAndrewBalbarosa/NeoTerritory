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

_to_windows_path() {
  # Convert /mnt/c/foo/bar -> C:\foo\bar (best-effort, only used inside WSL).
  local p="$1"
  if has wslpath; then
    wslpath -w "$p" 2>/dev/null && return 0
  fi
  if [[ "$p" =~ ^/mnt/([a-zA-Z])/(.*)$ ]]; then
    local drive="${BASH_REMATCH[1]^^}" rest="${BASH_REMATCH[2]//\//\\}"
    printf '%s:\\%s' "$drive" "$rest"
    return 0
  fi
  return 1
}

_force_remove_node_modules() {
  # Robust removal for node_modules, including the WSL-on-/mnt/c case where
  # Windows-held file handles cause "Input/output error" from rm -rf.
  local target="$1"
  [[ -d "$target" ]] || return 0

  # Rename first — frees the canonical path even if a few inner files refuse
  # to delete, and surfaces lock errors before npm install starts writing.
  local stash="${target}.stale.$$"
  if ! mv "$target" "$stash" 2>/dev/null; then
    stash="$target"
  fi

  if rm -rf "$stash" 2>/dev/null; then
    return 0
  fi

  # /mnt/c path under WSL — let Windows do the delete; it can break locks
  # that the 9P bridge can't touch.
  if [[ "$stash" == /mnt/[a-zA-Z]/* ]] && command -v cmd.exe >/dev/null 2>&1; then
    local winpath
    if winpath="$(_to_windows_path "$stash")"; then
      warn "rm failed on WSL/9P — retrying via Windows cmd.exe rmdir."
      cmd.exe /c "rmdir /s /q \"$winpath\"" >/dev/null 2>&1 || true
      [[ ! -d "$stash" ]] && return 0
    fi
  fi

  err "Could not delete $stash."
  err "Close any Windows process holding node_modules (VS Code, vite, node, antivirus scan)"
  err "and either rerun this script or delete the directory manually from Windows."
  return 1
}

ensure_node_modules() {
  local dir="$1" label="$2"
  if [[ -d "$dir/node_modules" ]]; then
    if _node_modules_platform_ok "$dir"; then
      ok "$label node_modules already present."
      return
    fi
    warn "$label node_modules built for a different platform — reinstalling for $(uname -s -m)."
    if ! _force_remove_node_modules "$dir/node_modules"; then
      err "$label node_modules reinstall aborted."
      exit 1
    fi
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
