#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# deploy-aws.sh - Native Node.js deployment to AWS Lightsail (v2.2-FIX)
# Slim dispatcher. Real logic lives in ops/bash/deploy/lib/*.sh.
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.env.deploy"
LIB="$ROOT_DIR/ops/bash/deploy/lib"

# shellcheck source=../ops/bash/deploy/lib/env.sh
source "$LIB/env.sh"
# shellcheck source=../ops/bash/deploy/lib/preflight.sh
source "$LIB/preflight.sh"
# shellcheck source=../ops/bash/deploy/lib/ship.sh
source "$LIB/ship.sh"
# shellcheck source=../ops/bash/deploy/lib/remote-build.sh
source "$LIB/remote-build.sh"

ASSUME_YES=0
RESTART_ONLY=0
CLEAN=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    --restart-only) RESTART_ONLY=1 ;;  # skip ship+build, just bounce pm2 on existing artifacts
    --clean|--from-scratch) CLEAN=1 ;;  # wipe remote app dir + caches before ship → true from-scratch rebuild
    --source) : ;;  # consumed elsewhere / informational
  esac
done
# Treat absent stdin TTY as "non-interactive" so prompts auto-accept.
if [ ! -t 0 ]; then ASSUME_YES=1; fi
export ASSUME_YES

echo "-- NeoTerritory Deploy Script (v2.2-FIX) --"
echo "Timestamp: $(date)"

load_deploy_env "$ENV_FILE"

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=240 -o TCPKeepAlive=yes -i $AWS_SSH_KEY"
SSH_TARGET="$AWS_USER@$AWS_HOST"
export SSH_OPTS SSH_TARGET ROOT_DIR AWS_HOST

verify_ssh_link
open_lightsail_ports
ensure_remote_node

if ! ask_yes "Proceed with deployment to $AWS_HOST? [y/N]"; then
  echo "Cancelled."; exit 0
fi

REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/$AWS_USER/neoterritory}"

if [ "$RESTART_ONLY" = "1" ]; then
  echo "-- RESTART-ONLY MODE: skipping ship + build, bouncing pm2 only --"
  run_remote_restart_only "$REMOTE_APP_DIR"
  echo "Restart complete -> http://$AWS_HOST"
  exit 0
fi

if [ "$CLEAN" = "1" ]; then
  echo "-- CLEAN MODE: wiping remote app dir + build caches for from-scratch rebuild --"
  # Stop pm2 first so it isn't holding open file handles in dist/.
  ssh $SSH_OPTS "$SSH_TARGET" "sudo pm2 delete neoterritory 2>/dev/null || true"
  ssh $SSH_OPTS "$SSH_TARGET" "set -e; \
    if [ -d '$REMOTE_APP_DIR' ]; then \
      echo '   [clean] wiping $REMOTE_APP_DIR contents (node_modules, dist, build, .deploy-cache, source)'; \
      sudo rm -rf '$REMOTE_APP_DIR'/Codebase '$REMOTE_APP_DIR'/scripts '$REMOTE_APP_DIR'/start.sh '$REMOTE_APP_DIR'/.deploy-cache; \
      echo '   [clean] remote dir is now empty:'; \
      ls -la '$REMOTE_APP_DIR' || true; \
    else \
      echo '   [clean] $REMOTE_APP_DIR did not exist — skipping wipe'; \
    fi"
fi

ship_source       "$REMOTE_APP_DIR"
write_remote_env  "$REMOTE_APP_DIR"
run_remote_build_and_start "$REMOTE_APP_DIR"

echo "Deployed Native Node.js (v2.2-FIX) -> http://$AWS_HOST"
