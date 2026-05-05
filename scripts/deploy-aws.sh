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
# Lock down anything sensitive on the local side before sourcing.
chmod 600 "$ENV_FILE" 2>/dev/null || true
# shellcheck disable=SC2046
set -a; . "$ENV_FILE"; set +a
if [ -n "${AWS_SSH_KEY:-}" ] && [ -f "$AWS_SSH_KEY" ]; then
  chmod 600 "$AWS_SSH_KEY" 2>/dev/null || true
  # WSL gotcha: keys on /mnt/c (NTFS) ignore chmod and stay 0777, so ssh
  # rejects them with "UNPROTECTED PRIVATE KEY FILE". Copy to a Linux
  # filesystem under ~/.ssh and use that copy instead.
  perms=$(stat -c '%a' "$AWS_SSH_KEY" 2>/dev/null || echo '600')
  case "$AWS_SSH_KEY" in
    /mnt/*)
      if [ "$perms" != '600' ] && [ "$perms" != '400' ]; then
        mkdir -p "$HOME/.ssh"
        chmod 700 "$HOME/.ssh"
        SAFE_KEY="$HOME/.ssh/$(basename "$AWS_SSH_KEY")"
        cp "$AWS_SSH_KEY" "$SAFE_KEY"
        chmod 600 "$SAFE_KEY"
        echo "ℹ Copied SSH key to $SAFE_KEY (NTFS can't enforce 0600)" >&2
        AWS_SSH_KEY="$SAFE_KEY"
      fi
      ;;
  esac
fi

# Supabase: only the SERVICE-ROLE key can write through RLS. The publishable
# / anon keys (sb_publishable_*, sb_anon_*, eyJ...role":"anon") are client-side
# and will silently fail every INSERT. Detect and refuse to forward those.
if [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
  case "$SUPABASE_SERVICE_KEY" in
    sb_publishable_*|sb_anon_*)
      echo "WARNING: SUPABASE_SERVICE_KEY looks like a publishable/anon key." >&2
      echo "         Admin-log mirror will be DISABLED for this deploy." >&2
      echo "         Get the service-role key from Supabase → Settings → API → 'service_role secret'." >&2
      SUPABASE_SERVICE_KEY=''
      ;;
    sb_secret_*|eyJ*)
      : # accepted: new-format secret OR legacy JWT-shaped service-role key
      ;;
    *)
      echo "WARNING: SUPABASE_SERVICE_KEY shape not recognized — proceeding anyway." >&2
      ;;
  esac
fi

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

# ── 2.5 Lightsail public port (best-effort, requires AWS CLI + creds) ──────
# Lightsail keeps a SEPARATE firewall on top of the instance. UFW alone won't
# expose anything publicly. If AWS_LIGHTSAIL_INSTANCE_NAME is set AND the
# AWS CLI is installed AND credentials are configured (aws configure), we
# open the port automatically; otherwise we print the manual one-liner.
open_lightsail_port() {
  if [ -z "${AWS_LIGHTSAIL_INSTANCE_NAME:-}" ]; then
    echo "ℹ AWS_LIGHTSAIL_INSTANCE_NAME not set — skipping auto port-open." >&2
    echo "  To open ports 80 and 443 manually:" >&2
    echo "    Lightsail console → Instance → Networking → IPv4 Firewall → Add HTTP/80 and HTTPS/443" >&2
    return 0
  fi
  if ! command -v aws >/dev/null 2>&1; then
    echo "ℹ aws CLI not installed — skipping auto port-open." >&2
    echo "  install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
    return 0
  fi
  local region="${AWS_LIGHTSAIL_REGION:-ap-southeast-1}"
  echo "── Opening Lightsail public ports 80, 443 on '$AWS_LIGHTSAIL_INSTANCE_NAME' (${region}) ──"
  if [ $DRY_RUN -eq 1 ]; then
    echo "→ aws lightsail put-instance-public-ports --instance-name $AWS_LIGHTSAIL_INSTANCE_NAME --region $region ..."
  else
    aws lightsail put-instance-public-ports \
      --region "$region" \
      --instance-name "$AWS_LIGHTSAIL_INSTANCE_NAME" \
      --port-infos "fromPort=22,toPort=22,protocol=tcp" \
                   "fromPort=80,toPort=80,protocol=tcp" \
                   "fromPort=443,toPort=443,protocol=tcp" \
      >/dev/null 2>&1 \
      && echo "✓ Lightsail firewall now allows 22, 80, 443" \
      || echo "⚠ aws lightsail put-instance-public-ports failed — open the port manually in the console" >&2
  fi
}
open_lightsail_port

# ── 2.6 SSL Setup (Let's Encrypt) ───────────────────────────────────────────
setup_ssl() {
  if [ -z "${AWS_DOMAIN:-}" ]; then
    echo "ℹ AWS_DOMAIN not set — skipping SSL setup. (Refer to docs/INFRA/FUTURE_REQUIREMENTS.md)"
    return 0
  fi
  
  echo "── Checking/Setting up SSL for ${AWS_DOMAIN} ──"
  ssh $SSH_OPTS "$SSH_TARGET" bash -s <<EOF
if ! command -v certbot >/dev/null 2>&1; then
  echo "→ installing certbot"
  sudo apt-get update && sudo apt-get install -y certbot python3-certbot-nginx
fi
if [ ! -d "/etc/letsencrypt/live/${AWS_DOMAIN}" ]; then
  echo "→ requesting new certificate for ${AWS_DOMAIN}"
  # Note: requires Nginx or similar to be installed and port 80 to be open.
  # This is a best-effort automated attempt.
  # sudo certbot --nginx -d ${AWS_DOMAIN} --non-interactive --agree-tos --email admin@${AWS_DOMAIN}
else
  echo "✓ certificate already exists for ${AWS_DOMAIN}"
fi
EOF
}
setup_ssl

# ── 3. Ship to AWS via SSH ──────────────────────────────────────────────────
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/$AWS_USER/neoterritory}"

if [ "$SHIP_MODE" = 'source' ]; then
  echo "── Shipping SOURCE to $SSH_TARGET:$REMOTE_APP_DIR (remote will build) ──"
  # ALLOWLIST, not blacklist. Only paths the docker build actually needs
  # leave the laptop. Anything outside this list (docs/, build/, out/,
  # test-artifacts/, playwright-scratch/, tools/, root .pem, AGENTS.md,
  # CLAUDE.md, Questionnaire*, root package.json, etc.) is by construction
  # impossible to ship — no exclude needed.
  TAR_INCLUDES=(
    Codebase/Backend
    Codebase/Frontend
    Codebase/Microservice
    Codebase/Infrastructure/session-orchestration/docker
    scripts
    # Root-level entry scripts — not used by the container, but handy for
    # in-instance debugging if you SSH in and want dev-mode tools.
    start.sh
    start.ps1
  )
  # Inside the included paths, still strip generated / heavy / secret bits.
  TAR_EXCLUDES=(
    --exclude='**/.git'
    --exclude='**/node_modules'
    --exclude='**/dist'
    --exclude='**/build'
    --exclude='**/build-linux'
    --exclude='**/out'
    --exclude='**/.next'
    --exclude='**/.cache'
    --exclude='**/coverage'
    --exclude='**/__pycache__'
    --exclude='**/*.log'
    --exclude='**/*.tsbuildinfo'
    --exclude='**/*.sqlite'
    --exclude='**/*.sqlite-journal'
    --exclude='**/.DS_Store'
    --exclude='**/Thumbs.db'
    # Secrets — never ship local creds; remote env-file carries them.
    --exclude='**/*.pem'
    --exclude='**/*.key'
    --exclude='**/.env'
    --exclude='**/.env.*'
    --exclude='Codebase/Backend/uploads'
    --exclude='Codebase/Backend/outputs'
    --exclude='Codebase/Backend/server.out.log'
    --exclude='Codebase/Backend/server.err.log'
    --exclude='Codebase/Backend/keys'
    # Microservice test inputs only — Runtime/ and samples/ are required
    # by CMake and the Dockerfile respectively, so they MUST stay.
    --exclude='Codebase/Microservice/Test'
    --exclude='Codebase/Microservice/build'
    --exclude='Codebase/Microservice/build-linux'
  )
  if [ $DRY_RUN -eq 1 ]; then
    echo "→ tar (allowlist: ${TAR_INCLUDES[*]}) → ssh $SSH_TARGET 'untar + docker build $IMAGE_REF'"
  else
    ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$REMOTE_APP_DIR'"
    tar -C "$ROOT_DIR" "${TAR_EXCLUDES[@]}" -czf - "${TAR_INCLUDES[@]}" \
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
  # Public origin the browser will hit. Default = http://<AWS_HOST>:<port>.
  # Override by setting CORS_ORIGIN in scripts/.env.deploy (e.g. once you
  # put a domain + TLS in front, set CORS_ORIGIN=https://your.domain).
  if [ -n "${CORS_ORIGIN:-}" ]; then
    echo "CORS_ORIGIN=$CORS_ORIGIN"
  else
    if [ "${AWS_HOST_PORT}" = "80" ]; then
      echo "CORS_ORIGIN=http://${AWS_HOST}"
    else
      echo "CORS_ORIGIN=http://${AWS_HOST}:${AWS_HOST_PORT}"
    fi
  fi
  [ -n "${JWT_SECRET:-}" ]         && echo "JWT_SECRET=$JWT_SECRET"
  [ -n "${GEMINI_API_KEY:-}" ]     && echo "GEMINI_API_KEY=$GEMINI_API_KEY"
  [ -n "${GEMINI_MODEL:-}" ]       && echo "GEMINI_MODEL=$GEMINI_MODEL"
  [ -n "${ANTHROPIC_API_KEY:-}" ]  && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
  [ -n "${ANTHROPIC_MODEL:-}" ]    && echo "ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
  [ -n "${AI_PROVIDER:-}" ]        && echo "AI_PROVIDER=$AI_PROVIDER"
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

URL="http://$AWS_HOST"
[ "$AWS_HOST_PORT" = "80" ] || URL="$URL:$AWS_HOST_PORT"
echo "✓ Deployed $IMAGE_REF → $URL"

# ── 4. Post-deploy reachability check (from THIS laptop, not from inside ──
#       the box). Confirms the Lightsail public firewall + UFW + container
#       port are all aligned. Skipped on --dry-run / --build-only.
if [ $DRY_RUN -eq 0 ] && [ $DO_PUSH -eq 1 ]; then
  echo "── Probing $URL from this laptop (waits up to 60s for first boot) ──"
  ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$URL/" 2>/dev/null || echo '000')
    if [ "$code" = "200" ] || [ "$code" = "204" ] || [ "$code" = "301" ] || [ "$code" = "302" ] || [ "$code" = "304" ]; then
      echo "  ✓ HTTP $code from $URL on attempt $attempt"
      ok=1; break
    fi
    echo "  [..] attempt $attempt: HTTP $code (retrying in 5s)"
    sleep 5
  done
  if [ $ok -eq 0 ]; then
    echo "⚠ External probe failed. The container may be running but the" >&2
    echo "  Lightsail public firewall is not letting traffic through." >&2
    echo "  Check: Lightsail console → Instance → Networking → IPv4 Firewall." >&2
    echo "  And on the remote box: ssh $SSH_TARGET 'docker logs --tail 50 $CONTAINER_NAME'" >&2
    exit 2
  fi
fi
