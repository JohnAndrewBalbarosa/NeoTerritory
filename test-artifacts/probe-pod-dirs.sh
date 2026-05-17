#!/usr/bin/env bash
set -euo pipefail
POD="$(docker ps --format '{{.Names}}' | grep '^nt-pod-' | head -1)"
echo "POD=$POD" >&2
SCRIPT='for d in /work/nt-compile_run-* /work/nt-unit_test-*; do
  if [ -d "$d" ]; then
    echo "=========================================="
    echo "DIR: $d"
    ls "$d"
    echo "--- user_class.h head ---"
    head -5 "$d/user_class.h" 2>/dev/null || true
    echo "--- driver.cpp head ---"
    head -10 "$d/driver.cpp" 2>/dev/null || true
    echo "--- recompile ---"
    cd "$d" && g++ -std=c++17 -O0 -g driver.cpp -o probe_bin 2>&1
    echo "exit=$?"
  fi
done'
docker exec "$POD" sh -c "$SCRIPT"
