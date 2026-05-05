#!/usr/bin/env bash
# `start.sh test` — k8s multi-user provisioning sim.

invoke_test() {
  has kubectl || { err 'kubectl not on PATH. Run ./start.sh k8s first.'; exit 1; }
  local tpl_dir="$ROOT_DIR/Codebase/Infrastructure/session-orchestration/k8s/templates"
  [[ -f "$tpl_dir/user-session-pod.yaml" && -f "$tpl_dir/user-routing.yaml" ]] || {
    err "k8s templates missing under $tpl_dir"; exit 1; }
  step "Simulating $USERS users requesting C++ isolated sessions"
  for ((i=1; i<=USERS; i++)); do
    local uid="dev-student-$i"
    echo "  -> provisioning $uid"
    sed "s/{{user_id}}/$uid/g" "$tpl_dir/user-session-pod.yaml" | kubectl apply -f -
    sed "s/{{user_id}}/$uid/g" "$tpl_dir/user-routing.yaml"     | kubectl apply -f -
  done
  sleep 3
  kubectl get pods
}
