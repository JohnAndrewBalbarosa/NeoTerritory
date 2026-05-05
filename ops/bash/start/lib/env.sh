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

case "${OS:-}" in *Windows*) BIN_NAME='NeoTerritory.exe' ;; *) BIN_NAME='NeoTerritory' ;; esac

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
MS_BUILD_DIR="${MS_BUILD_DIR:-build-$MS_ENV_TAG}"
BIN_PATH="$MS_DIR/$MS_BUILD_DIR/$BIN_NAME"
