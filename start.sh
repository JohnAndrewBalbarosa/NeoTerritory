#!/usr/bin/env bash
# NeoTerritory — single root entry (POSIX side).
#
# Slim dispatcher. All real logic lives under ops/bash/start/{lib,commands}/.
# See docs/Codebase/DESIGN_DECISIONS.md (D28).
#
# Usage:
#   ./start.sh                                 # dev (default)
#   ./start.sh --local                         # Local computer deployment (dev)
#   ./start.sh --aws                           # AWS Lightsail deployment only
#   ./start.sh --both                          # Both local and AWS deployment
#   ./start.sh --lan                           # dev, exposed to LAN
#   ./start.sh dev --lan --backend-port 4000
#   ./start.sh prod                            # production build (npm run build + node dist + vite preview)
#   ./start.sh prod --lan                      # production build, exposed to LAN
#   ./start.sh setup                           # first-time provision
#   ./start.sh setup --mode full --lan         # unattended full provision
#   ./start.sh k8s                             # minikube/kubectl
#   ./start.sh browser --lan                   # clean Chromium
#   ./start.sh test --users 5                  # k8s multi-user sim
#   ./start.sh deploy --source                 # AWS ship-to-cloud (was deploy-aws.sh)
#   ./start.sh rebuild                         # full local rebuild (canonical)
#   ./start.sh rebuild --skip-microservice     # exclude C++ build
#   ./start.sh rebuild --mode-a                # rebuild then hot-reload

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LIB="$HERE/ops/bash/start/lib"
CMD="$HERE/ops/bash/start/commands"

print_help() { sed -n '2,21p' "$0"; }

# shellcheck source=ops/bash/start/lib/env.sh
source "$LIB/env.sh"
# shellcheck source=ops/bash/start/lib/output.sh
source "$LIB/output.sh"
# shellcheck source=ops/bash/start/lib/host.sh
source "$LIB/host.sh"
# shellcheck source=ops/bash/start/lib/build.sh
source "$LIB/build.sh"
# shellcheck source=ops/bash/start/lib/args.sh
source "$LIB/args.sh"

# shellcheck source=ops/bash/start/commands/dev.sh
source "$CMD/dev.sh"
# shellcheck source=ops/bash/start/commands/setup.sh
source "$CMD/setup.sh"
# shellcheck source=ops/bash/start/commands/k8s.sh
source "$CMD/k8s.sh"
# shellcheck source=ops/bash/start/commands/browser.sh
source "$CMD/browser.sh"
# shellcheck source=ops/bash/start/commands/test.sh
source "$CMD/test.sh"
# shellcheck source=ops/bash/start/commands/deploy.sh
source "$CMD/deploy.sh"

# 'rebuild' bypasses the start-args parser entirely — its flags
# (--skip-microservice, --skip-frontend, --skip-backend, --skip-docker,
# --mode-a) are owned by scripts/rebuild.sh and must pass through unparsed.
if [[ "${1:-}" == "rebuild" ]]; then
  shift
  exec "$HERE/scripts/rebuild.sh" "$@"
fi

init_arg_defaults
parse_args "$@"

if [[ "$BOTH" -eq 1 ]]; then
  step 'Running BOTH Local and AWS deployment'
  NO_BROWSER=1 invoke_dev &
  DEV_PID=$!
  invoke_deploy
  step "AWS Deployment triggered. Local dev is running in background (pid $DEV_PID)."
  wait "$DEV_PID"
  exit 0
fi

case "$COMMAND" in
  dev)     invoke_dev ;;
  prod)    PROD=1; invoke_dev ;;
  setup)   invoke_setup ;;
  k8s)     invoke_k8s ;;
  browser) invoke_browser_inline ;;
  test)    invoke_test ;;
  deploy)  invoke_deploy ;;
  *)       invoke_dev ;;
esac
