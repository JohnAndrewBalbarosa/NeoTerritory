#!/usr/bin/env bash
# Argument parsing — sets COMMAND + flag globals from "$@".

init_arg_defaults() {
  COMMAND='dev'
  LAN=0
  BIND_HOST=''
  BACKEND_PORT="${BACKEND_PORT:-3001}"
  FRONTEND_PORT="${FRONTEND_PORT:-5173}"
  BOTH=0
  REST_ARGS=()

  REBUILD=0; BACKEND_ONLY=0; NO_BROWSER=0; SKIP_POD=0; USE_CHROME=0; PROD=0
  SKIP_BUILD=0

  MODE='dev'; SKIP_MICRO=0; AUTO_START=0; ANTHROPIC_KEY=''; ANTHROPIC_MODEL='claude-sonnet-4-6'

  RESET=0

  URL_ARG=''; USE_PW=1   # default to Playwright for parity with start.ps1

  USERS=3
}

parse_args() {
  if [[ $# -gt 0 ]]; then
    case "$1" in
      dev|prod|setup|k8s|browser|test|deploy) COMMAND="$1"; shift ;;
    esac
  fi

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --lan)               LAN=1 ;;
      --host)              shift; BIND_HOST="${1:-}" ;;
      --backend-port)      shift; BACKEND_PORT="${1:-3001}" ;;
      --frontend-port)     shift; FRONTEND_PORT="${1:-5173}" ;;
      --deploy|--aws)      COMMAND='deploy' ;;
      --local)             COMMAND='dev' ;;
      --both)              BOTH=1 ;;
      --rebuild)           REBUILD=1 ;;
      --backend-only)      BACKEND_ONLY=1 ;;
      --no-browser)        NO_BROWSER=1 ;;
      --skip-pod)          SKIP_POD=1 ;;
      --use-chrome)        USE_CHROME=1; USE_PW=0 ;;
      --prod)              PROD=1 ;;
      --skip-build)        SKIP_BUILD=1 ;;
      --mode)              shift; MODE="${1:-dev}" ;;
      --skip-microservice) SKIP_MICRO=1 ;;
      --auto-start)        AUTO_START=1 ;;
      --anthropic-key)     shift; ANTHROPIC_KEY="${1:-}" ;;
      --anthropic-model)   shift; ANTHROPIC_MODEL="${1:-claude-sonnet-4-6}" ;;
      --reset)             RESET=1 ;;
      --pw|--playwright)   USE_PW=1; USE_CHROME=0 ;;
      http*|https*)        URL_ARG="$1" ;;
      --users)             shift; USERS="${1:-3}" ;;
      -h|--help)           print_help; exit 0 ;;
      *)                   REST_ARGS+=("$1") ;;
    esac
    shift
  done
}
