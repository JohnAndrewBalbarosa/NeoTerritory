#!/usr/bin/env bash
# Infrastructure bootstrap — preflight Docker + Kubernetes tooling, build the
# session-pod image, and apply k8s templates if a cluster is reachable.
# Designed for WSL2 with Docker Engine (not Docker Desktop required).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/session-orchestration"

say() { printf "\033[1;32m[infra]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[infra] %s\033[0m\n" "$*"; }

IMAGE_TAG="${IMAGE_TAG:-neoterritory-session:dev}"
SKIP_K8S="${SKIP_K8S:-0}"

# --- Docker ----------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  say "docker $(docker --version)"
  if docker info >/dev/null 2>&1; then
    say "Building image: $IMAGE_TAG"
    docker build -f docker/Dockerfile -t "$IMAGE_TAG" "$HERE/.."
  else
    warn "docker present but daemon not reachable. Start it:  sudo service docker start"
  fi
else
  warn "docker not installed. Install Docker Engine inside WSL:"
  warn "  curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker \$USER"
  warn "  Then log out / log back into WSL."
fi

# --- Kubernetes ------------------------------------------------------------
if [ "$SKIP_K8S" = "1" ]; then
  say "SKIP_K8S=1 — skipping cluster steps."
  exit 0
fi

if ! command -v kubectl >/dev/null 2>&1; then
  warn "kubectl not installed. Install:"
  warn "  curl -LO 'https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl'"
  warn "  sudo install -m 0755 kubectl /usr/local/bin/kubectl"
  exit 0
fi
say "kubectl $(kubectl version --client --output=yaml 2>/dev/null | grep gitVersion | head -n1 | awk '{print $2}')"

if ! kubectl cluster-info >/dev/null 2>&1; then
  warn "No reachable cluster. Start one with minikube:"
  warn "  minikube start --driver=docker"
  warn "Then re-run this script (or:  kubectl apply -f k8s/templates/ )"
  exit 0
fi

say "Applying k8s templates…"
kubectl apply -f k8s/templates/ || warn "Some templates failed — they may need values substitution."
say "Done. Inspect:  kubectl get pods,svc"
