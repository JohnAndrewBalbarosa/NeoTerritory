#!/usr/bin/env bash
# `start.sh deploy` — thin wrapper around scripts/deploy-aws.sh.

invoke_deploy() {
  local deploy_script="$ROOT_DIR/scripts/deploy-aws.sh"
  if [[ ! -f "$deploy_script" ]]; then err "Deploy script not found: $deploy_script"; exit 1; fi
  bash "$deploy_script" "${REST_ARGS[@]}"
}
