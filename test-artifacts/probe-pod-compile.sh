#!/usr/bin/env bash
set -euo pipefail
POD="$(docker ps --format '{{.Names}}' | grep '^nt-pod-' | head -1)"
echo "POD=$POD"
docker exec "$POD" sh -c '
  set -e
  D=$(ls -1 /work/ | head -1)
  echo "DIR=$D"
  ls /work/$D
  echo "--- driver.cpp head ---"
  head -30 /work/$D/driver.cpp 2>&1 || true
  echo "--- compile attempt ---"
  cd /work/$D
  g++ -std=c++17 -O0 -g driver.cpp -o user_main 2>&1
  echo "exit=$?"
  ls -la user_main 2>&1 || echo "no binary produced"
'
