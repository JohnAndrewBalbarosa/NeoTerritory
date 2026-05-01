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
  local strict=1
  [[ "$soft" == 'soft' ]] && strict=0

  _has() { command -v "$1" >/dev/null 2>&1; }
  _step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
  _ok()   { printf '\033[32m    [OK] %s\033[0m\n' "$*"; }
  _warn() { printf '\033[33m    [!!] %s\033[0m\n' "$*"; }
  _err()  { printf '\033[31m    [XX] %s\033[0m\n' "$*"; }

  # _require <name> <fix-hint> — checks the tool and either:
  #   strict: prints [XX], the fix hint, and returns 1 from the function
  #   soft:   prints [!!] + hint and continues
  _require() {
    local name="$1" hint="$2"
    if _has "$name"; then
      _ok "$name found"
      return 0
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

  _step "Verifying requirements (profile: $profile, mode: $([ $strict -eq 1 ] && echo strict || echo soft))"

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
    if timeout 5 docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
      _ok 'docker daemon responding'
    else
      if [[ $strict -eq 1 ]]; then
        _err 'MISSING: docker daemon (docker is installed but the daemon is not running)'
        _err '  fix: sudo service docker start    # WSL / Linux'
        _err '       open Docker Desktop          # macOS / Windows'
        _err 'Refusing to continue — start the Docker daemon and re-run.'
        return 1
      else
        _warn 'docker daemon not responding — continuing in soft mode'
      fi
    fi
  ;; esac

  # --- full ----------------------------------------------------------------
  if [[ "$profile" == 'full' ]]; then
    _require git 'install git — https://git-scm.com or `apt-get install git`' || return 1
  fi

  _ok 'All requirements satisfied.'
  return 0
}
