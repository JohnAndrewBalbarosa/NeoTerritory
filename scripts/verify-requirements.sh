#!/usr/bin/env bash
# NeoTerritory — shared requirements verifier (POSIX side).
#
# Sourced by start.sh, bootstrap.sh, etc.:
#     # shellcheck source=scripts/verify-requirements.sh
#     source "$(dirname "$0")/scripts/verify-requirements.sh"
#     verify_requirements dev          # exits non-zero on hard miss
#     verify_requirements pods soft    # warns instead of exits
#
# Profiles: minimal | dev | pods | full

verify_requirements() {
  local profile="${1:-dev}"
  local soft="${2:-}"
  local missing=()

  _has() { command -v "$1" >/dev/null 2>&1; }
  _step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
  _ok()   { printf '\033[32m    [OK] %s\033[0m\n' "$*"; }
  _warn() { printf '\033[33m    [!!] %s\033[0m\n' "$*"; }
  _err()  { printf '\033[31m    [XX] %s\033[0m\n' "$*"; }

  _step "Verifying requirements (profile: $profile)"

  # --- minimal --------------------------------------------------------------
  if _has node; then _ok "node $(node --version 2>/dev/null)";
  else missing+=('node (https://nodejs.org)'); _err 'node not found'; fi
  if _has npm;  then _ok "npm $(npm --version 2>/dev/null)";
  else missing+=('npm (bundled with node)'); _err 'npm not found'; fi

  # --- dev / pods / full ----------------------------------------------------
  case "$profile" in dev|pods|full)
    if _has cmake; then _ok 'cmake present';
    else missing+=('cmake (https://cmake.org)'); _err 'cmake not found'; fi
    if   _has g++;     then _ok 'g++ found'
    elif _has clang++; then _ok 'clang++ found'
    elif _has cl.exe;  then _ok 'MSVC cl.exe found'
    else missing+=('a C++17 compiler (g++ / clang++)'); _err 'no C++17 compiler found'
    fi
  ;; esac

  # --- pods ----------------------------------------------------------------
  case "$profile" in pods|full)
    if _has docker; then
      _ok 'docker on PATH'
      if timeout 5 docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
        _ok 'docker daemon responding'
      else
        _warn 'docker daemon not responding (start Docker Desktop / dockerd)'
        [[ "$soft" != 'soft' ]] && missing+=('docker daemon (start Docker Desktop)')
      fi
    else
      _warn 'docker not on PATH — per-user pod isolation will fall back to local sandbox'
      [[ "$soft" != 'soft' ]] && missing+=('docker (https://www.docker.com/products/docker-desktop)')
    fi
  ;; esac

  # --- full ----------------------------------------------------------------
  if [[ "$profile" == 'full' ]]; then
    if _has git; then _ok 'git found';
    else missing+=('git'); _err 'git not found'; fi
  fi

  if (( ${#missing[@]} > 0 )); then
    if [[ "$soft" == 'soft' ]]; then
      _warn 'Some optional requirements are missing — continuing in degraded mode.'
      return 0
    fi
    _err ''
    _err 'Missing requirements:'
    for m in "${missing[@]}"; do _err "  - $m"; done
    return 1
  fi
  _ok 'All requirements satisfied.'
  return 0
}
