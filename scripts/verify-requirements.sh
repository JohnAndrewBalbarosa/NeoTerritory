#!/usr/bin/env bash
# NeoTerritory — shared requirements verifier (POSIX side).
#
# STRICT BY DEFAULT, SEQUENTIAL. NeoTerritory is a high-criticality app;
# scripts that run it stop the moment a required tool is missing. Each
# check runs in dependency order and exits non-zero on the FIRST miss
# without probing the remaining tools — there's no point telling the
# operator about a missing g++ when node isn't even installed yet.
#
# Sourced by start.sh, bootstrap.sh, etc.:
#     # shellcheck source=scripts/verify-requirements.sh
#     source "$(dirname "$0")/scripts/verify-requirements.sh"
#     verify_requirements dev               # strict — exits 1 on first miss
#     verify_requirements pods soft         # WARNINGS only — never exits
#
# Profiles: minimal | dev | pods | full
#
# Soft mode is for orchestrators that legitimately need to keep going
# with a degraded surface (e.g. bootstrap.sh installing the missing
# tools itself). End-user scripts should always use the strict default.

verify_requirements() {
  local profile="${1:-dev}"
  local soft="${2:-}"
  local auto_install="${3:-}"
  local strict=1
  [[ "$soft" == 'soft' ]] && strict=0

  _has() { command -v "$1" >/dev/null 2>&1; }
  _step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
  _ok()   { printf '\033[32m    [OK] %s\033[0m\n' "$*"; }
  _warn() { printf '\033[33m    [!!] %s\033[0m\n' "$*"; }
  _err()  { printf '\033[31m    [XX] %s\033[0m\n' "$*"; }

  _try_install() {
    local name="$1"
    [[ "$auto_install" != "auto" ]] && return 1
    
    local pkg_brew="$name"
    local pkg_apt="$name"
    
    case "$name" in
      node) pkg_apt="nodejs" ;;
      npm)  pkg_apt="nodejs" ;; # npm usually comes with nodejs on apt too
      g++)  pkg_brew="gcc"; pkg_apt="build-essential" ;;
      docker) pkg_apt="docker.io" ;;
      aws)  pkg_brew="awscli"; pkg_apt="awscli" ;;
    esac

    if _has brew; then
      _step "Attempting to install $name via brew ($pkg_brew)..."
      brew install "$pkg_brew" && return 0
    elif _has apt-get; then
      _step "Attempting to install $name via apt-get ($pkg_apt)..."
      sudo apt-get update && sudo apt-get install -y "$pkg_apt" && return 0
    fi
    return 1
  }

  # _require <name> <fix-hint> — checks the tool and either:
  #   strict: prints [XX], the fix hint, and returns 1 from the function
  #   soft:   prints [!!] + hint and continues
  _require() {
    local name="$1" hint="$2"
    if _has "$name"; then
      _ok "$name found"
      return 0
    fi
    
    if _try_install "$name"; then
      if _has "$name"; then
        _ok "$name installed and found"
        return 0
      fi
    fi

    if [[ $strict -eq 1 ]]; then
      _err "MISSING: $name"
      _err "  fix: $hint"
      _err "Refusing to continue — install $name and re-run."
      return 1
    else
      _warn "missing: $name ($hint) — continuing in soft mode"
      return 0
    fi
  }

  local mode_label="strict"
  [[ "$soft" == "soft" ]] && mode_label="soft"
  [[ "$auto_install" == "auto" ]] && mode_label="auto-install"
  _step "Verifying requirements (profile: $profile, mode: $mode_label)"

  # --- minimal --------------------------------------------------------------
  _require node 'install Node.js — https://nodejs.org' || return 1
  _require npm  'reinstall Node.js (npm ships with it)' || return 1

  case "$profile" in dev|pods|full)
    # --- dev ----------------------------------------------------------------
    _require cmake 'install CMake — https://cmake.org/download (or apt-get install cmake)' || return 1
    if _has g++; then
      _ok 'g++ found'
    elif _has clang++; then
      _ok 'clang++ found'
    elif _has cl.exe; then
      _ok 'MSVC cl.exe found'
    else
      if [[ $strict -eq 1 ]]; then
        _err 'MISSING: g++ / clang++ / cl (C++17 compiler)'
        _err '  fix: apt-get install build-essential   # debian/ubuntu'
        _err '       brew install gcc                  # macOS'
        _err '       Visual Studio Build Tools         # Windows'
        _err 'Refusing to continue — install a C++17 compiler and re-run.'
        return 1
      else
        _warn 'missing: C++17 compiler — continuing in soft mode'
      fi
    fi
  ;; esac

  case "$profile" in pods|full)
    # --- pods ---------------------------------------------------------------
    _require docker 'install Docker — https://www.docker.com/products/docker-desktop or `curl -fsSL https://get.docker.com | sh`' || return 1

    # Try to reach the daemon. If it isn't responding, try to start it
    # ourselves (WSL/Linux: `service docker start`) and retry up to
    # NEOTERRITORY_DOCKER_WAIT seconds (default 30) before giving up.
    # Override the wait via env: NEOTERRITORY_DOCKER_WAIT=60 ./start.sh
    local wait_total="${NEOTERRITORY_DOCKER_WAIT:-30}"
    local _docker_ok=0
    if timeout 5 docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
      _docker_ok=1
    else
      # Try a one-shot start on Linux/WSL where `service` is available.
      if command -v service >/dev/null 2>&1 && [[ "$(uname -s)" != "Darwin" ]]; then
        _warn 'docker daemon not responding — attempting `sudo service docker start`'
        if sudo -n true 2>/dev/null; then
          sudo service docker start >/dev/null 2>&1 || true
        else
          # No passwordless sudo — try without sudo (rootless / already root).
          service docker start >/dev/null 2>&1 || true
        fi
      else
        _warn 'docker daemon not responding — waiting for Docker Desktop to come up'
      fi

      # Poll until the daemon answers or we exhaust the budget.
      local waited=0
      while [[ $waited -lt $wait_total ]]; do
        if timeout 3 docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
          _docker_ok=1; break
        fi
        sleep 2; waited=$((waited + 2))
        printf '    [..] still waiting for docker daemon (%ss / %ss)\n' "$waited" "$wait_total"
      done
    fi

    if [[ $_docker_ok -eq 1 ]]; then
      _ok 'docker daemon responding'
    elif [[ $strict -eq 1 ]]; then
      _err "MISSING: docker daemon (still unreachable after ${wait_total}s)"
      _err '  fix: sudo service docker start    # WSL / Linux'
      _err '       open Docker Desktop          # macOS / Windows'
      _err '  override wait budget: NEOTERRITORY_DOCKER_WAIT=60 ./start.sh ...'
      return 1
    else
      _warn 'docker daemon not responding — continuing in soft mode'
    fi
  ;; esac

  # --- full ----------------------------------------------------------------
  if [[ "$profile" == 'full' ]]; then
    _require git 'install git — https://git-scm.com or `apt-get install git`' || return 1
  fi

  _ok 'All requirements satisfied.'
  return 0
}
