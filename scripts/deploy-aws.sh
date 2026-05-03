#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy-aws.sh — one-shot push of NeoTerritory (frontend + backend +
# microservice, packaged via Codebase/Infrastructure/session-orchestration/
# docker/Dockerfile) to a running AWS EC2 instance over SSH.
#
# No AWS CLI / ECR dependency: cheap-spot-instance friendly. Two ship modes:
#
#   --image  (default) Build everything locally, docker save | ssh docker load.
#            Heavy upload (GBs) but the remote needs only docker.
#   --source             Tar the repo, scp to remote, remote runs the same
#            multi-stage docker build. Tiny upload, remote needs docker +
#            ~2 min build time. Auto-installs docker if missing.
#
# Usage:
#   scripts/deploy-aws.sh                 # image mode, build + push everything
#   scripts/deploy-aws.sh --source        # ship source, build on AWS side
#   scripts/deploy-aws.sh --frontend      # only rebuild frontend layer + ship
#   scripts/deploy-aws.sh --backend --microservice
#   scripts/deploy-aws.sh --no-build      # skip local builds, only ship image
#   scripts/deploy-aws.sh --build-only    # build image, don't push
#   scripts/deploy-aws.sh --no-supabase   # ship without Supabase env (local SQLite only)
#   scripts/deploy-aws.sh --dry-run       # print actions, change nothing
#
# Required env (load from scripts/.env.deploy — copy from .env.deploy.example):
#   AWS_HOST, AWS_USER, AWS_SSH_KEY
# Optional env: see .env.deploy.example.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.env.deploy"
DOCKERFILE="$ROOT_DIR/Codebase/Infrastructure/session-orchestration/docker/Dockerfile"

# ── Flags ───────────────────────────────────────────────────────────────────
DO_FRONTEND=0
DO_BACKEND=0
DO_MICROSERVICE=0
DO_DOCKER=1
DO_PUSH=1
USE_SUPABASE=1
DRY_RUN=0
ANY_COMPONENT=0
SHIP_MODE='image'   # 'image' (default) | 'source'

usage() { sed -n '2,30p' "$0"; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --frontend)      DO_FRONTEND=1; ANY_COMPONENT=1 ;;
    --backend)       DO_BACKEND=1;  ANY_COMPONENT=1 ;;
    --microservice)  DO_MICROSERVICE=1; ANY_COMPONENT=1 ;;
    --docker)        DO_DOCKER=1; ANY_COMPONENT=1 ;;
    --no-docker)     DO_DOCKER=0 ;;
    --no-build)      DO_FRONTEND=0; DO_BACKEND=0; DO_MICROSERVICE=0 ;;
    --build-only)    DO_PUSH=0 ;;
    --no-supabase)   USE_SUPABASE=0 ;;
    --source)        SHIP_MODE='source' ;;   # ship source, build on remote
    --image)         SHIP_MODE='image' ;;    # build local, ship docker image
    --dry-run)       DRY_RUN=1 ;;
    -h|--help)       usage 0 ;;
    *) echo "unknown flag: $1" >&2; usage 1 ;;
  esac
  shift
done

# In source-ship mode, local builds are pointless — the remote does them.
if [ "$SHIP_MODE" = 'source' ]; then
  DO_FRONTEND=0; DO_BACKEND=0; DO_MICROSERVICE=0; DO_DOCKER=0
fi

# Default = build everything when no component flag was passed.
if [ $ANY_COMPONENT -eq 0 ]; then
  DO_FRONTEND=1; DO_BACKEND=1; DO_MICROSERVICE=1; DO_DOCKER=1
fi

run() {
  echo "→ $*"
  [ $DRY_RUN -eq 1 ] || "$@"
}

# ── Load env ────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: missing $ENV_FILE — copy scripts/.env.deploy.example and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC2046
set -a; . "$ENV_FILE"; set +a

: "${IMAGE_NAME:=neoterritory}"
: "${IMAGE_TAG:=latest}"
: "${CONTAINER_NAME:=neoterritory}"
: "${AWS_HOST_PORT:=80}"

require() {
  local name="$1"; local val="${!1:-}"
  if [ -z "$val" ]; then echo "ERROR: $name is required in $ENV_FILE" >&2; exit 1; fi
}

if [ $DO_PUSH -eq 1 ]; then
  require AWS_HOST; require AWS_USER; require AWS_SSH_KEY
  [ -f "$AWS_SSH_KEY" ] || { echo "ERROR: AWS_SSH_KEY not found: $AWS_SSH_KEY" >&2; exit 1; }
fi

IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i $AWS_SSH_KEY"
SSH_TARGET="$AWS_USER@$AWS_HOST"

# ── 1. Local component builds ───────────────────────────────────────────────
if [ $DO_FRONTEND -eq 1 ]; then
  echo "── Building frontend ──"
  ( cd "$ROOT_DIR/Codebase/Frontend" && run npm ci && run npm run build )
fi

if [ $DO_BACKEND -eq 1 ]; then
  echo "── Building backend ──"
  ( cd "$ROOT_DIR/Codebase/Backend" && run npm ci && run npm run build )
fi

if [ $DO_MICROSERVICE -eq 1 ]; then
  echo "── Compiling C++ microservice ──"
  MS_BUILD="$ROOT_DIR/Codebase/Microservice/build-linux"
  run mkdir -p "$MS_BUILD"
  ( cd "$MS_BUILD" && run cmake "$ROOT_DIR/Codebase/Microservice" && run cmake --build . -- -j )
fi

# ── 2. Docker image ─────────────────────────────────────────────────────────
if [ $DO_DOCKER -eq 1 ]; then
  echo "── Building Docker image $IMAGE_REF ──"
  ( cd "$ROOT_DIR" && run docker build -f "$DOCKERFILE" -t "$IMAGE_REF" . )
fi

if [ $DO_PUSH -eq 0 ]; then
  echo "✓ build-only: skipping ship to $AWS_HOST"; exit 0
fi

# ── 3. Ship to AWS via SSH ──────────────────────────────────────────────────
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/$AWS_USER/neoterritory}"

if [ "$SHIP_MODE" = 'source' ]; then
  echo "── Shipping SOURCE to $SSH_TARGET:$REMOTE_APP_DIR (remote will build) ──"
  # Tar up the repo, excluding heavy / generated paths. Remote untars +
  # docker-builds the same multi-stage Dockerfile we'd build locally.
  TAR_EXCLUDES=(
    --exclude='.git'
    --exclude='node_modules'
    --exclude='Codebase/Backend/node_modules'
    --exclude='Codebase/Frontend/node_modules'
    --exclude='Codebase/Frontend/dist'
    --exclude='Codebase/Backend/dist'
    --exclude='Codebase/Microservice/build'
    --exclude='Codebase/Microservice/build-linux'
    --exclude='build'
    --exclude='out'
    --exclude='test-artifacts'
    --exclude='*.log'
    --exclude='scripts/.env.deploy'
    --exclude='*.pem'
    --exclude='*.key'
    # Kubernetes / minikube tooling — not used by the Docker deploy.
    --exclude='Codebase/Infrastructure/minikube-linux-amd64'
    --exclude='Codebase/Infrastructure/session-orchestration/k8s'
    --exclude='Codebase/Infrastructure/session-orchestration/bootstrap_and_deploy'
    --exclude='Codebase/Infrastructure/session-orchestration/bootstrap_and_deploy.ps1'
  )
  if [ $DRY_RUN -eq 1 ]; then
    echo "→ tar source → ssh $SSH_TARGET 'untar + docker build $IMAGE_REF'"
  else
    ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$REMOTE_APP_DIR'"
    tar -C "$ROOT_DIR" "${TAR_EXCLUDES[@]}" -czf - . \
      | ssh $SSH_OPTS "$SSH_TARGET" "tar -C '$REMOTE_APP_DIR' -xzf -"
    ssh $SSH_OPTS "$SSH_TARGET" bash -s <<EOF
set -e
cd "$REMOTE_APP_DIR"
# Sanity-check Docker is installed; install if missing (Debian/Ubuntu).
if ! command -v docker >/dev/null 2>&1; then
  echo "→ installing docker on remote"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "\$USER" || true
fi
docker build -f "Codebase/Infrastructure/session-orchestration/docker/Dockerfile" -t "$IMAGE_REF" .
EOF
  fi
else
  echo "── Shipping IMAGE to $SSH_TARGET ──"
  if [ $DRY_RUN -eq 1 ]; then
    echo "→ docker save $IMAGE_REF | ssh $SSH_TARGET 'docker load'"
  else
    docker save "$IMAGE_REF" | ssh $SSH_OPTS "$SSH_TARGET" 'docker load'
  fi
fi

# Build remote env-file. We only forward keys the backend actually reads,
# and only include Supabase when USE_SUPABASE=1 AND keys are present.
REMOTE_ENV="/tmp/${CONTAINER_NAME}.env.$$"
TMP_ENV="$(mktemp)"
{
  echo "PORT=3001"
  echo "NODE_ENV=production"
  [ -n "${JWT_SECRET:-}" ]         && echo "JWT_SECRET=$JWT_SECRET"
  [ -n "${ANTHROPIC_API_KEY:-}" ]  && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  [ -n "${ADMIN_USERNAME:-}" ]     && echo "ADMIN_USERNAME=$ADMIN_USERNAME"
  [ -n "${ADMIN_PASSWORD:-}" ]     && echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
  if [ $USE_SUPABASE -eq 1 ] && [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
    echo "SUPABASE_URL=$SUPABASE_URL"
    echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY"
    [ -n "${SUPABASE_LOGS_TABLE:-}" ]  && echo "SUPABASE_LOGS_TABLE=$SUPABASE_LOGS_TABLE"
    [ -n "${SUPABASE_AUDIT_TABLE:-}" ] && echo "SUPABASE_AUDIT_TABLE=$SUPABASE_AUDIT_TABLE"
    echo "✓ Supabase mirror enabled (admin/audit logs → $SUPABASE_URL)" >&2
  else
    echo "ℹ Supabase mirror disabled — container will use local SQLite only" >&2
  fi
} > "$TMP_ENV"

if [ $DRY_RUN -eq 1 ]; then
  echo "→ scp env to $REMOTE_ENV ; ssh restart container"
  rm -f "$TMP_ENV"
else
  scp $SSH_OPTS "$TMP_ENV" "$SSH_TARGET:$REMOTE_ENV" >/dev/null
  rm -f "$TMP_ENV"
  ssh $SSH_OPTS "$SSH_TARGET" bash -s <<EOF
set -e
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
docker run -d \\
  --name "$CONTAINER_NAME" \\
  --restart unless-stopped \\
  -p ${AWS_HOST_PORT}:3001 \\
  --env-file "$REMOTE_ENV" \\
  -v ${CONTAINER_NAME}-data:/app/Codebase/Backend/src/db \\
  "$IMAGE_REF"
shred -u "$REMOTE_ENV" 2>/dev/null || rm -f "$REMOTE_ENV"
docker ps --filter "name=$CONTAINER_NAME"
EOF
fi

echo "✓ Deployed $IMAGE_REF → http://$AWS_HOST:$AWS_HOST_PORT"
