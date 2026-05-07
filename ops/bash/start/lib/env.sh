#!/usr/bin/env bash
# Shared paths and environment-tagged build dir for the C++ microservice.
# Sourced by start.sh and every ops/bash/start/commands/*.sh module.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Codebase/Backend"
FRONTEND_DIR="$ROOT_DIR/Codebase/Frontend"
MS_DIR="$ROOT_DIR/Codebase/Microservice"
DOCKERFILE="$BACKEND_DIR/docker/cpp-pod.Dockerfile"
POD_IMAGE="neoterritory/cpp-pod:latest"
ENV_FILE="$BACKEND_DIR/.env"

# Environment-tagged build directory so a CMake cache produced inside WSL2
# never collides with one produced by Windows-native cmake or MSYS2 (CMake
# refuses to reuse a cache whose absolute source path style differs).
case "$(uname -s 2>/dev/null)" in
  Linux*)   if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then MS_ENV_TAG=wsl; else MS_ENV_TAG=linux; fi ;;
  Darwin*)  MS_ENV_TAG=macos ;;
  MINGW*|MSYS*)  MS_ENV_TAG=msys ;;
  CYGWIN*)  MS_ENV_TAG=cygwin ;;
  *)        MS_ENV_TAG=unknown ;;
esac
# Pick binary name from the detected env tag, NOT $OS. $OS=Windows_NT leaks
# from the Windows-side parent shell into WSL, which would otherwise misroute
# every BIN_PATH consumer (verify_microservice_binary, env-file rendering)
# to NeoTerritory.exe inside a Linux build directory.
case "$MS_ENV_TAG" in
  msys|cygwin) BIN_NAME='NeoTerritory.exe' ;;
  *)           BIN_NAME='NeoTerritory'     ;;
esac
MS_BUILD_DIR="${MS_BUILD_DIR:-build-$MS_ENV_TAG}"
BIN_PATH="$MS_DIR/$MS_BUILD_DIR/$BIN_NAME"
# Visual Studio / multi-config generators drop the binary under a Debug/Release
# subdir. Probe for the multi-config layout if the top-level path is missing.
if [[ ! -f "$BIN_PATH" ]]; then
  for _cfg in Debug Release RelWithDebInfo MinSizeRel; do
    if [[ -f "$MS_DIR/$MS_BUILD_DIR/$_cfg/$BIN_NAME" ]]; then
      BIN_PATH="$MS_DIR/$MS_BUILD_DIR/$_cfg/$BIN_NAME"; break
    fi
    if [[ -f "$MS_DIR/$MS_BUILD_DIR/$_cfg/NeoTerritory.exe" ]]; then
      BIN_PATH="$MS_DIR/$MS_BUILD_DIR/$_cfg/NeoTerritory.exe"; break
    fi
  done
  unset _cfg
fi
