#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# lightsail-launch.sh — first-boot provisioning for an AWS Lightsail instance
# (Ubuntu 22.04 / 24.04). Run this ONCE on a fresh instance to install Docker,
# open the firewall, prepare the app dir, and (optionally) run the container
# from a baked .env. Idempotent — re-running is safe.
#
# Two ways to use it:
#
# 1) UserData / Launch script (Lightsail console → Add launch script):
#      Paste the entire contents of this file. Lightsail runs it as root on
#      first boot. Container won't auto-start unless you also bake env vars
#      into /etc/neoterritory.env (see PRESEED block at the bottom).
#
# 2) Manual (recommended for the secret-sensitive parts):
#      scp this file to the instance, then:
#        ssh ubuntu@<IP> 'sudo bash /tmp/lightsail-launch.sh'
#      then run scripts/deploy-aws.sh --source from your laptop to push code.
#
# After this script:
#   - docker + docker compose installed
#   - 'ubuntu' user is in the docker group (re-login or use newgrp docker)
#   - /home/ubuntu/neoterritory exists (deploy target)
#   - ufw allows 22, 80, 443
#   - swap added (1G) — Lightsail nano/micro instances OOM during builds without it
#
# Lightsail networking note: ALSO open the same ports in
# Lightsail console → Instance → Networking → IPv4 Firewall.
# UFW alone won't expose them publicly.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOG=/var/log/neoterritory-launch.log
exec > >(tee -a "$LOG") 2>&1
echo "[lightsail-launch] $(date -Is) starting"

if [ "$(id -u)" -ne 0 ]; then
  echo "must run as root (use sudo)" >&2; exit 1
fi

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="/home/${APP_USER}/neoterritory"
ENV_FILE="/etc/neoterritory.env"
IMAGE_REF="${IMAGE_REF:-neoterritory:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-neoterritory}"
HOST_PORT="${HOST_PORT:-80}"

# ── 0. Pre-flight ───────────────────────────────────────────────────────────
# Multi-stage docker build needs ~3 GB free during the cmake/g++ stage.
FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
if [ "${FREE_GB:-0}" -lt 5 ]; then
  echo "WARNING: only ${FREE_GB}G free on /. Multi-stage docker build needs ~3-5G." >&2
fi

# Sanity: this script installs DOCKER ONLY. No kubectl / minikube / k3s.
# CMake is pulled inside the build container (debian:bookworm-slim) and
# never touches the host. The C++ microservice compiles in-stage and only
# the resulting binary lands in the runtime image.

# ── 1. Base packages ────────────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release ufw rsync git unattended-upgrades

# ── 2. Swap (1G) — small Lightsail plans OOM during docker builds ──────────
if ! swapon --show | grep -q '/swapfile'; then
  echo "[lightsail-launch] adding 1G swapfile"
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 3. Docker (official repo) ───────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "[lightsail-launch] installing docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$APP_USER" || true

# ── 4. Firewall (host-side; Lightsail console firewall is separate) ────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 5. App dir + Docker volume for SQLite persistence ──────────────────────
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
docker volume create "${CONTAINER_NAME}-data" >/dev/null

# ── 6. Optional: auto-run if /etc/neoterritory.env + image already present ──
# Populate $ENV_FILE (chmod 600) with backend secrets to enable auto-start.
# Otherwise the container starts when scripts/deploy-aws.sh ships it.
if [ -f "$ENV_FILE" ] && docker image inspect "$IMAGE_REF" >/dev/null 2>&1; then
  echo "[lightsail-launch] env + image present — (re)starting $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "${HOST_PORT}:3001" \
    --env-file "$ENV_FILE" \
    -v "${CONTAINER_NAME}-data:/app/Codebase/Backend/src/db" \
    "$IMAGE_REF"
  docker ps --filter "name=$CONTAINER_NAME"
else
  cat <<'NOTE'

[lightsail-launch] provisioning done. Container NOT started yet.

Next steps (from your laptop):
  1. Open Lightsail → Instance → Networking → add HTTP (80) to the firewall.
  2. cp scripts/.env.deploy.example scripts/.env.deploy  ; fill in values
     (AWS_HOST = this instance's public IP, AWS_USER = ubuntu,
      AWS_SSH_KEY = path to the .pem you downloaded from Lightsail).
  3. scripts/deploy-aws.sh --source     # ship code, remote builds & runs

To enable auto-restart on reboot WITHOUT re-running deploy:
  - sudo nano /etc/neoterritory.env   # paste backend env (JWT_SECRET, etc.)
  - sudo chmod 600 /etc/neoterritory.env
  - re-run this script: sudo bash /path/to/lightsail-launch.sh
NOTE
fi

# ── 7. Auto security upgrades ──────────────────────────────────────────────
dpkg-reconfigure -f noninteractive unattended-upgrades || true

echo "[lightsail-launch] $(date -Is) done"
