#!/usr/bin/env bash
# `start.sh k8s` — minikube cluster bootstrap (replaces the old setup.sh).

invoke_k8s() {
  has minikube || { err 'minikube not found.'; exit 1; }
  has kubectl  || { err 'kubectl not found.'; exit 1; }
  has docker   || { err 'docker not found.'; exit 1; }

  if [[ "$RESET" -eq 1 ]]; then
    step 'Tearing down minikube before re-deploy'
    minikube delete >/dev/null 2>&1 || true
  fi

  step 'Starting Minikube cluster'
  minikube start --driver=docker

  step 'Connecting to minikube docker daemon'
  eval "$(minikube docker-env)"

  step 'Building neoterritory:latest image (network=host)'
  docker build --network=host -t neoterritory:latest \
    -f "$ROOT_DIR/Codebase/Infrastructure/session-orchestration/docker/Dockerfile" "$ROOT_DIR"

  step 'Applying k8s templates'
  kubectl apply -f "$ROOT_DIR/Codebase/Infrastructure/session-orchestration/k8s/templates/"

  step 'Pod status'
  kubectl get pods
  echo
  echo 'To port-forward a session:'
  echo '  kubectl port-forward pod/neoterritory-session-user123 8080:8080'
}
