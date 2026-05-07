#!/usr/bin/env bash
# ops/bash/rebuild/microservice.sh — rebuild only the C++ microservice binary.
#
# Standalone:  ./ops/bash/rebuild/microservice.sh
# Orchestrated: called by scripts/rebuild.sh and start.sh --rebuild=...
#
# Idempotent in the sense that cmake itself short-circuits unchanged sources;
# this script always invokes cmake --build but prints a before/after sha256
# so a no-op build is visible.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

MS_DIR="Codebase/Microservice"
case "$(uname -s 2>/dev/null)" in
  Linux*)   if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then MS_ENV_TAG=wsl; else MS_ENV_TAG=linux; fi ;;
  Darwin*)  MS_ENV_TAG=macos ;;
  MINGW*|MSYS*) MS_ENV_TAG=msys ;;
  CYGWIN*)  MS_ENV_TAG=cygwin ;;
  *)        MS_ENV_TAG=unknown ;;
esac
BUILD_DIR="$MS_DIR/build-$MS_ENV_TAG"
# Pick binary name from the detected env tag, NOT $OS. $OS=Windows_NT leaks
# from the Windows-side parent shell into WSL, which would otherwise
# misroute us to NeoTerritory.exe inside a Linux build directory.
case "$MS_ENV_TAG" in
  msys|cygwin) BIN_NAME='NeoTerritory.exe' ;;
  *)           BIN_NAME='NeoTerritory'     ;;
esac
BIN_PATH="$BUILD_DIR/$BIN_NAME"
# Visual Studio / multi-config generators drop the binary under a config
# subdir (Debug/, Release/). Probe those if the top-level path is missing.
resolve_bin_path() {
  if [[ -f "$BIN_PATH" ]]; then return 0; fi
  for cfg in Debug Release RelWithDebInfo MinSizeRel; do
    if [[ -f "$BUILD_DIR/$cfg/$BIN_NAME" ]]; then
      BIN_PATH="$BUILD_DIR/$cfg/$BIN_NAME"
      return 0
    fi
    # MSVC writes .exe even when BIN_NAME is the unix form.
    if [[ -f "$BUILD_DIR/$cfg/NeoTerritory.exe" ]]; then
      BIN_PATH="$BUILD_DIR/$cfg/NeoTerritory.exe"
      return 0
    fi
  done
}

hash_file() {
  if [[ -f "$1" ]]; then sha256sum "$1" | awk '{print substr($1,1,12)}'; else echo absent; fi
}

echo "[rebuild:microservice] build dir : $BUILD_DIR"
resolve_bin_path
echo "[rebuild:microservice] before sha: $(hash_file "$BIN_PATH")"

if [[ ! -f "$BUILD_DIR/CMakeCache.txt" ]]; then
  echo "[rebuild:microservice] no CMake cache — running configure"
  cmake -S "$MS_DIR" -B "$BUILD_DIR"
fi

cmake --build "$BUILD_DIR" --parallel

resolve_bin_path
AFTER="$(hash_file "$BIN_PATH")"
echo "[rebuild:microservice] after  sha: $AFTER"
echo "[rebuild:microservice] binary    : $BIN_PATH"
if [[ "$AFTER" == "absent" ]]; then
  echo "[rebuild:microservice] ERROR: binary not produced at $BIN_PATH" >&2
  exit 1
fi
