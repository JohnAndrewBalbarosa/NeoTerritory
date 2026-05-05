#!/usr/bin/env bash
# Microservice bootstrap — configures + builds the C++ NeoTerritory binary.
# Requires: cmake >= 3.16, a C++17 compiler (g++/clang++), make.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

say() { printf "\033[1;33m[microservice]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[microservice] %s\033[0m\n" "$*" >&2; exit 1; }

command -v cmake >/dev/null 2>&1 || fail "cmake not found. Install:  sudo apt install -y cmake build-essential"
command -v make  >/dev/null 2>&1 || fail "make not found. Install:  sudo apt install -y build-essential"
command -v g++   >/dev/null 2>&1 || command -v clang++ >/dev/null 2>&1 || fail "C++ compiler not found."

# Pick a build directory that is unique per environment so a cache produced
# inside (say) WSL2 cannot collide with one produced by Windows-native cmake
# or MSYS2 — CMake stores absolute source paths in CMakeCache.txt and refuses
# to reuse a cache whose path style differs from the current invocation.
detect_env_tag() {
  case "$(uname -s 2>/dev/null)" in
    Linux*)
      if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then echo wsl
      else echo linux; fi ;;
    Darwin*) echo macos ;;
    MINGW*|MSYS*) echo msys ;;
    CYGWIN*) echo cygwin ;;
    *)       echo unknown ;;
  esac
}
BUILD_DIR="${BUILD_DIR:-build-$(detect_env_tag)}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

say "cmake $(cmake --version | head -n1)"
say "Configuring → $BUILD_DIR"
cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release

say "Building with $JOBS job(s)…"
cmake --build "$BUILD_DIR" --config Release -j "$JOBS"

BIN="$(find "$BUILD_DIR" -maxdepth 3 -type f -name 'NeoTerritory*' -executable 2>/dev/null | head -n1 || true)"
if [ -n "$BIN" ]; then
  # Emit repo-relative paths so the wiring guidance is portable across
  # checkouts and machines instead of leaking the current developer's $HOME.
  REPO_ROOT="$(cd "$HERE/../.." && pwd)"
  rel_to_repo() { realpath --relative-to="$REPO_ROOT" "$1"; }
  say "Built binary: $BIN"
  say "Wire it into Backend via .env (paths are repo-relative):"
  say "  NEOTERRITORY_BIN=$(rel_to_repo "$BIN")"
  say "  NEOTERRITORY_CATALOG=$(rel_to_repo "$HERE/pattern_catalog")"
else
  say "Build finished but no binary auto-detected. Check $BUILD_DIR/."
fi
