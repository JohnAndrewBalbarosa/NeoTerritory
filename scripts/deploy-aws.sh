#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.sh — Native Node.js deployment to AWS Lightsail (v2.2-FIX)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.env.deploy"

ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    --source) : ;;  # consumed elsewhere / informational
  esac
done
# Treat absent stdin TTY as "non-interactive" so prompts auto-accept.
if [ ! -t 0 ]; then ASSUME_YES=1; fi

ask_yes() {
  # $1 = prompt
  if [ "$ASSUME_YES" = 1 ]; then
    echo "$1 [auto-yes]"
    return 0
  fi
  printf '%s ' "$1"
  local reply
  if [ -r /dev/tty ]; then
    read -r reply < /dev/tty
  else
    read -r reply
  fi
  [[ "$reply" =~ ^[yY]$ ]]
}

echo "── NeoTerritory Deploy Script (v2.2-FIX) ──"
echo "Timestamp: $(date)"

# ── Load env ────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: missing $ENV_FILE" >&2; exit 1
fi
chmod 600 "$ENV_FILE" 2>/dev/null || true
set -a; . "$ENV_FILE"; set +a

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i $AWS_SSH_KEY"
SSH_TARGET="$AWS_USER@$AWS_HOST"

# ── 1. Basic Connection Check ──
echo "── Verifying SSH connection to $SSH_TARGET ──"
if ! ssh $SSH_OPTS "$SSH_TARGET" "echo 'Link OK'" >/dev/null 2>&1; then
  echo "ERROR: Cannot reach $SSH_TARGET. Check your IP/Key/Firewall."; exit 1
fi
echo "✓ Link established."

# ── 2. AWS CLI Readiness (Laptop Side) ──
if [ -n "${AWS_LIGHTSAIL_INSTANCE_NAME:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    region="${AWS_LIGHTSAIL_REGION:-ap-southeast-1}"
    echo "── Opening Lightsail ports 80, 443 on '$AWS_LIGHTSAIL_INSTANCE_NAME' ──"
    aws lightsail put-instance-public-ports --region "$region" --instance-name "$AWS_LIGHTSAIL_INSTANCE_NAME" \
      --port-infos "fromPort=22,toPort=22,protocol=tcp" "fromPort=80,toPort=80,protocol=tcp" "fromPort=443,toPort=443,protocol=tcp" \
      >/dev/null 2>&1 && echo "✓ Firewall updated." || echo "⚠ Firewall update failed (check credentials)."
  else
    echo "ℹ AWS CLI not found, skipping firewall auto-open."
  fi
fi

# ── 3. Remote Node.js Readiness Check ──
echo "── Verifying remote Node.js environment ──"
# We force a login shell to ensure we see the installed node/npm
if ! ssh $SSH_OPTS "$SSH_TARGET" "bash -l -c 'command -v node && command -v npm'" >/dev/null 2>&1; then
  echo "⚠ Remote server is missing Node.js or npm." >&2
  if ask_yes "Would you like to run provisioning (lightsail-launch.sh) now? [y/N]"; then
    echo "→ Provisioning $SSH_TARGET..."
    scp $SSH_OPTS "$ROOT_DIR/scripts/lightsail-launch.sh" "$SSH_TARGET:/tmp/lightsail-launch.sh"
    ssh $SSH_OPTS "$SSH_TARGET" "sudo bash /tmp/lightsail-launch.sh"
    echo "✓ Provisioning complete."
  else
    echo "✗ Cannot proceed without Node.js."; exit 1
  fi
fi
echo "✓ Remote Node.js environment OK."

if ! ask_yes "Proceed with deployment to $AWS_HOST? [y/N]"; then
  echo "Cancelled."; exit 0
fi

# ── 4. Ship Source Code ──
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/$AWS_USER/neoterritory}"
echo "── Shipping SOURCE to $SSH_TARGET ──"
TAR_INCLUDES=( Codebase/Backend Codebase/Frontend Codebase/Microservice Codebase/Infrastructure/session-orchestration/docker scripts start.sh )
TAR_EXCLUDES=( --exclude='**/.git' --exclude='**/node_modules' --exclude='**/dist' --exclude='**/build' --exclude='**/build-linux' --exclude='**/.env' )
ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$REMOTE_APP_DIR'"
tar -C "$ROOT_DIR" "${TAR_EXCLUDES[@]}" -czf - "${TAR_INCLUDES[@]}" | ssh $SSH_OPTS "$SSH_TARGET" "tar -C '$REMOTE_APP_DIR' -xzf -"

# Build remote env
REMOTE_ENV_PATH="$REMOTE_APP_DIR/Codebase/Backend/.env"
TMP_ENV="$(mktemp)"
{
  echo "PORT=80"
  echo "SSL_PORT=443"
  echo "NODE_ENV=production"
  echo "CORS_ORIGIN=http://${AWS_HOST}"
  [ -n "${JWT_SECRET:-}" ] && echo "JWT_SECRET=$JWT_SECRET"
  [ -n "${GEMINI_API_KEY:-}" ] && echo "GEMINI_API_KEY=$GEMINI_API_KEY"
  [ -n "${ANTHROPIC_API_KEY:-}" ] && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  echo "NEOTERRITORY_BIN=$REMOTE_APP_DIR/Codebase/Microservice/build/NeoTerritory"
  echo "NEOTERRITORY_CATALOG=$REMOTE_APP_DIR/Codebase/Microservice/pattern_catalog"
} > "$TMP_ENV"
scp $SSH_OPTS "$TMP_ENV" "$SSH_TARGET:$REMOTE_ENV_PATH" >/dev/null
rm -f "$TMP_ENV"

# ── 5. Remote Build & Execution ──
echo "── Running Remote Build & Start ──"
ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
# Force PATH update for non-interactive shells
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin

cd "$REMOTE_APP_DIR"

echo "── Installing Backend dependencies (npm ci, lockfile-pinned) ──"
( cd Codebase/Backend && (npm ci --include=dev || npm install --include=dev) && npm run build )

echo "── Installing Frontend dependencies (npm ci, lockfile-pinned) ──"
( cd Codebase/Frontend && (npm ci || npm install) && npm run build )

echo "── Compiling Microservice (-j1, low-RAM Lightsail safe) ──"
mkdir -p Codebase/Microservice/build
# 1GB Lightsail instances OOM-kill cc1plus even on serial builds when a
# single template-heavy translation unit needs >2GB. Combine:
#   - serial make
#   - -O0 (kills heavy optimizer memory)
#   - --param ggc-min-heapsize=131072 (smaller GC heap)
#   - 4G swapfile (set up by lightsail-launch.sh)
( cd Codebase/Microservice/build \
  && cmake -DCMAKE_BUILD_TYPE=Debug \
           -DCMAKE_CXX_FLAGS="-O0 -g0 --param ggc-min-heapsize=131072 --param ggc-min-expand=10" \
           .. \
  && make -j1 )

echo "── Freeing Ports 80/443 & Starting PM2 ──"
sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  [ -n "\$PID" ] && sudo kill -9 \$PID && sleep 1
done

cd Codebase/Backend
# Ensure PM2 is installed globally on the host
sudo npm install -g pm2 2>/dev/null || true
sudo pm2 delete neoterritory 2>/dev/null || true
sudo PORT=80 SSL_PORT=443 pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save
EOF

echo "✓ Deployed Native Node.js (v2.2-FIX) → http://$AWS_HOST"
