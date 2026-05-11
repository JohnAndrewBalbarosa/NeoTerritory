#!/bin/bash
# Wrapper that translates Windows-style paths in arguments to /mnt/c paths
# and execs the Linux NeoTerritory binary inside WSL. Called from the
# Windows-side run-wsl.cmd via `wsl bash <this-script>`.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ARGS=()
for arg in "$@"; do
  case "$arg" in
    [A-Za-z]:[\\/]*)
      ARGS+=("$(wslpath -u "$arg")")
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done
exec "$DIR/NeoTerritory" "${ARGS[@]}"
