#!/usr/bin/env bash
# NeoTerritory — single root entry (POSIX side).
#
# Replaces: bootstrap.sh, deploy.ps1 (full mode), run-dev.ps1 (dev mode),
#           setup.sh (k8s mode), clean-browser.sh (browser mode), test.sh.
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

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Codebase/Backend"
FRONTEND_DIR="$ROOT_DIR/Codebase/Frontend"
MS_DIR="$ROOT_DIR/Codebase/Microservice"
DOCKERFILE="$BACKEND_DIR/docker/cpp-pod.Dockerfile"
POD_IMAGE="neoterritory/cpp-pod:latest"
ENV_FILE="$BACKEND_DIR/.env"

case "${OS:-}" in *Windows*) BIN_NAME='NeoTerritory.exe' ;; *) BIN_NAME='NeoTerritory' ;; esac

# Environment-tagged build directory so a CMake cache produced inside WSL2
# never collides with one produced by Windows-native cmake or MSYS2 (CMake
# refuses to reuse a cache whose absolute source path style differs).
case "$(uname -s 2>/dev/null)" in
  Linux*)   if grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; then MS_ENV_TAG=wsl; else MS_ENV_TAG=linux; fi ;;
  Darwin*)  MS_ENV_TAG=macos ;;
  MINGW*|MSYS*)  MS_ENV_TAG=msys ;;
  CYGWIN*)  MS_ENV_TAG=cygwin ;;
  *)        MS_ENV_TAG=unknown ;;
esac
MS_BUILD_DIR="${MS_BUILD_DIR:-build-$MS_ENV_TAG}"
BIN_PATH="$MS_DIR/$MS_BUILD_DIR/$BIN_NAME"

# ── Defaults ────────────────────────────────────────────────────────────────
COMMAND='dev'
LAN=0
BIND_HOST=''
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BOTH=0
REST_ARGS=()

# dev / prod
REBUILD=0; BACKEND_ONLY=0; NO_BROWSER=0; SKIP_POD=0; USE_CHROME=0; PROD=0
SKIP_BUILD=0

# setup
MODE='dev'; SKIP_MICRO=0; AUTO_START=0; ANTHROPIC_KEY=''; ANTHROPIC_MODEL='claude-sonnet-4-6'

# k8s
RESET=0

# browser
URL_ARG=''; USE_PW=1   # default to Playwright for parity with start.ps1

# test
USERS=3

# ── Parse subcommand (first non-flag arg) and flags ────────────────────────
if [[ $# -gt 0 ]]; then
  case "$1" in
    dev|prod|setup|k8s|browser|test|deploy) COMMAND="$1"; shift ;;
  esac
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lan)            LAN=1 ;;
    --host)           shift; BIND_HOST="${1:-}" ;;
    --backend-port)   shift; BACKEND_PORT="${1:-3001}" ;;
    --frontend-port)  shift; FRONTEND_PORT="${1:-5173}" ;;
    --deploy|--aws)   COMMAND='deploy' ;;
    --local)          COMMAND='dev' ;;
    --both)           BOTH=1 ;;
    # dev
    --rebuild)        REBUILD=1 ;;
    --backend-only)   BACKEND_ONLY=1 ;;
    --no-browser)     NO_BROWSER=1 ;;
    --skip-pod)       SKIP_POD=1 ;;
    --use-chrome)     USE_CHROME=1; USE_PW=0 ;;
    --prod)           PROD=1 ;;
    --skip-build)     SKIP_BUILD=1 ;;
    # setup
    --mode)           shift; MODE="${1:-dev}" ;;
    --skip-microservice) SKIP_MICRO=1 ;;
    --auto-start)     AUTO_START=1 ;;
    --anthropic-key)  shift; ANTHROPIC_KEY="${1:-}" ;;
    --anthropic-model) shift; ANTHROPIC_MODEL="${1:-claude-sonnet-4-6}" ;;
    # k8s
    --reset)          RESET=1 ;;
    # browser
    --pw|--playwright) USE_PW=1; USE_CHROME=0 ;;
    http*|https*)     URL_ARG="$1" ;;
    # test
    --users)          shift; USERS="${1:-3}" ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) REST_ARGS+=("$1") ;;
  esac
  shift
done

# ── Output helpers ──────────────────────────────────────────────────────────
step() { printf '\033[36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    [ok] %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    [!!] %s\033[0m\n' "$*"; }
err()  { printf '\033[31m    [xx] %s\033[0m\n' "$*" >&2; }
has()  { command -v "$1" >/dev/null 2>&1; }

# ── LAN / host resolution ───────────────────────────────────────────────────
get_lan_ip() {
  local ip=''
  if has hostname; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [[ -z "$ip" ]] && has ipconfig; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
  fi
  [[ "$ip" == 127.* || "$ip" == 169.254.* ]] && ip=''
  echo "$ip"
}

resolve_bind_host() {
  if [[ -n "$BIND_HOST" ]]; then echo "$BIND_HOST"
  elif [[ "$LAN" -eq 1 ]];  then echo '0.0.0.0'
  else                            echo '127.0.0.1'
  fi
}

resolve_advertise_host() {
  if [[ -n "$BIND_HOST" && "$BIND_HOST" != '0.0.0.0' ]]; then echo "$BIND_HOST"; return; fi
  if [[ "$LAN" -eq 1 ]]; then
    local ip; ip="$(get_lan_ip)"
    if [[ -n "$ip" ]]; then echo "$ip"; return; fi
    warn 'Could not detect a LAN IPv4 — printed URL falls back to localhost.'
  fi
  echo 'localhost'
}

is_wsl2() { grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null; }

wait_url() {
  local url="$1" tries="${2:-120}" i
  for ((i=0; i<tries; i++)); do
    if curl -fs -m 2 -o /dev/null "$url" 2>/dev/null; then return 0; fi
    sleep 0.5
  done
  return 1
}

ensure_node_modules() {
  local dir="$1" label="$2"
  if [[ -d "$dir/node_modules" ]]; then ok "$label node_modules already present."; return; fi
  step "Installing $label npm dependencies"
  ( cd "$dir" && npm install )
  ok "$label node_modules installed."
}

build_microservice() {
  local force="${1:-0}"
  if [[ "$force" -eq 0 && -f "$BIN_PATH" ]]; then
    ok "Microservice binary already built: $BIN_PATH"
    return
  fi
  step "Building microservice (CMake → $MS_BUILD_DIR)"
  ( cd "$MS_DIR" && cmake -S . -B "$MS_BUILD_DIR" && cmake --build "$MS_BUILD_DIR" --parallel )
  ok "Microservice built: $BIN_PATH"
}

write_dev_env() {
  local port="$1" vite_port="$2" advert="$3"
  if [[ -f "$ENV_FILE" ]]; then ok '.env already exists — leaving in place.'; return; fi
  step 'Creating Backend/.env with defaults'
  local cors="http://localhost:$port,http://localhost:$vite_port"
  [[ "$advert" != 'localhost' ]] && cors="$cors,http://$advert:$port,http://$advert:$vite_port"
  cat >"$ENV_FILE" <<EOF
PORT=$port
CORS_ORIGIN=$cors
DB_PATH=./src/db/database.sqlite

# Anthropic Claude integration. Leave unset to run microservice-only mode.
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# Microservice integration. Defaults derived from project layout.
# NEOTERRITORY_BIN=$BIN_PATH
# NEOTERRITORY_CATALOG=$MS_DIR/pattern_catalog
EOF
  ok ".env created at $ENV_FILE"
}

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: dev
# ─────────────────────────────────────────────────────────────────────────────
invoke_dev() {
  # shellcheck source=scripts/verify-requirements.sh
  source "$ROOT_DIR/scripts/verify-requirements.sh"
  local req_profile='pods'
  [[ "$SKIP_POD" -eq 1 ]] && req_profile='dev'
  if ! verify_requirements "$req_profile" "" "auto"; then
    err 'Aborting — requirements not met.'; exit 1
  fi

  local bind advert
  bind="$(resolve_bind_host)"
  advert="$(resolve_advertise_host)"

  if [[ "$LAN" -eq 1 ]] && is_wsl2; then
    warn 'Running --lan inside WSL2: WSL2 eth0 is NOT reachable from your LAN.'
    warn '  Run .\start.ps1 -Lan from Windows PowerShell instead, or configure netsh portproxy.'
  fi

  if [[ "$SKIP_POD" -eq 0 ]]; then
    step 'Checking Docker pod image'
    if ! has docker; then
      warn 'docker not on PATH — pod isolation skipped; backend uses local sandbox.'
    elif ! docker image inspect "$POD_IMAGE" >/dev/null 2>&1; then
      if [[ -f "$DOCKERFILE" ]]; then
        step "Building $POD_IMAGE from $DOCKERFILE"
        if ! docker build -f "$DOCKERFILE" -t "$POD_IMAGE" "$(dirname "$DOCKERFILE")"; then
          warn 'docker build failed — falling back to local sandbox.'
        else ok "$POD_IMAGE ready."
        fi
      else warn "Dockerfile not found at $DOCKERFILE — pod isolation unavailable."
      fi
    else ok "$POD_IMAGE already built."
    fi
  fi

  ensure_node_modules "$BACKEND_DIR" 'Backend'
  [[ "$BACKEND_ONLY" -eq 0 ]] && ensure_node_modules "$FRONTEND_DIR" 'Frontend'
  write_dev_env "$BACKEND_PORT" "$FRONTEND_PORT" "$advert"
  build_microservice "$REBUILD"

  if [[ "$PROD" -eq 1 && "$SKIP_BUILD" -eq 0 ]]; then
    step 'Building Backend (npm run build)'
    ( cd "$BACKEND_DIR" && npm run build )
    ok 'Backend build complete.'
    if [[ "$BACKEND_ONLY" -eq 0 ]]; then
      step 'Building Frontend (npm run build)'
      ( cd "$FRONTEND_DIR" && npm run build )
      ok 'Frontend build complete.'
    fi
  fi

  local backend_cmd='npm run dev'
  [[ "$PROD" -eq 1 ]] && backend_cmd='npm run start'

  step "Starting backend (bind=$bind, port=$BACKEND_PORT, mode=$([[ "$PROD" -eq 1 ]] && echo prod || echo dev))"
  local backend_env=(
    PORT="$BACKEND_PORT"
    HOST="$bind"
    TMPDIR=/tmp TMP=/tmp TEMP=/tmp
  )
  if [[ "$LAN" -eq 1 && "$advert" != 'localhost' ]]; then
    backend_env+=(CORS_ORIGIN="http://localhost:$BACKEND_PORT,http://localhost:$FRONTEND_PORT,http://$advert:$BACKEND_PORT,http://$advert:$FRONTEND_PORT")
  fi
  # tsx unix socket workaround: force linux TMPDIR (see legacy comment in old start.sh).
  env "${backend_env[@]}" bash -c "cd '$BACKEND_DIR' && $backend_cmd" \
    >"$BACKEND_DIR/server.out.log" 2>"$BACKEND_DIR/server.err.log" &
  BACKEND_PID=$!
  step "Backend started (pid $BACKEND_PID)"

  HEALTH_TRIES=120
  if ! wait_url "http://127.0.0.1:$BACKEND_PORT/api/health" "$HEALTH_TRIES"; then
    # wait_url polls every 0.5s, so HEALTH_TRIES * 0.5 = budget seconds.
    err "Backend did not become healthy within $((HEALTH_TRIES / 2))s. Last lines of server.err.log:"
    [[ -f "$BACKEND_DIR/server.err.log" ]] && tail -30 "$BACKEND_DIR/server.err.log" || true
    kill "$BACKEND_PID" 2>/dev/null || true
    exit 1
  fi
  ok 'Backend healthy.'

  VITE_PID=''
  if [[ "$BACKEND_ONLY" -eq 0 ]]; then
    local vite_label='Vite dev server'
    local vite_script='dev'
    if [[ "$PROD" -eq 1 ]]; then vite_label='Vite preview'; vite_script='preview'; fi
    step "Starting $vite_label (bind=$bind, port=$FRONTEND_PORT)"
    local vite_host_args=''
    if [[ "$LAN" -eq 1 || "$bind" == '0.0.0.0' ]]; then vite_host_args='--host 0.0.0.0'
    elif [[ -n "$BIND_HOST" ]]; then vite_host_args="--host $BIND_HOST"
    fi
    env VITE_HOST="$bind" TMPDIR=/tmp TMP=/tmp TEMP=/tmp \
      bash -c "cd '$FRONTEND_DIR' && npm run $vite_script -- --port $FRONTEND_PORT --strictPort $vite_host_args" \
      >"$FRONTEND_DIR/vite.out.log" 2>"$FRONTEND_DIR/vite.err.log" &
    VITE_PID=$!
    step "Vite started (pid $VITE_PID)"
    if ! wait_url "http://127.0.0.1:$FRONTEND_PORT/" 60; then
      err 'Vite did not start within 30s.'
      [[ -f "$FRONTEND_DIR/vite.err.log" ]] && tail -30 "$FRONTEND_DIR/vite.err.log" || true
      kill "$BACKEND_PID" "$VITE_PID" 2>/dev/null || true
      exit 1
    fi
    ok 'Vite ready.'
  fi

  cleanup() {
    step 'Shutting down'
    [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "${VITE_PID:-}"    ]] && kill "$VITE_PID"    2>/dev/null || true
    ok 'Stopped.'
  }
  trap cleanup EXIT INT TERM

  local studio_port="$FRONTEND_PORT"
  [[ "$BACKEND_ONLY" -eq 1 ]] && studio_port="$BACKEND_PORT"
  local local_url="http://localhost:$studio_port"
  local lan_url=''
  [[ "$advert" != 'localhost' ]] && lan_url="http://$advert:$studio_port"
  local open_url="${lan_url:-$local_url}"

  echo
  echo "  Studio:        $local_url"
  [[ -n "$lan_url" ]] && echo "  Studio (LAN):  $lan_url"
  echo "  Backend API:   http://localhost:$BACKEND_PORT"
  echo "  Health:        http://localhost:$BACKEND_PORT/api/health"
  echo

  if [[ "$NO_BROWSER" -eq 0 ]]; then
    step 'Launching clean Chromium'
    URL_ARG="$open_url" invoke_browser_inline &
  fi

  echo 'Ctrl+C stops the backend, Vite, and the browser.'
  tail -F "$BACKEND_DIR/server.out.log"
}

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: setup
# ─────────────────────────────────────────────────────────────────────────────
invoke_setup() {
  cd "$ROOT_DIR"
  if [[ -f "$ROOT_DIR/scripts/verify-requirements.sh" ]]; then
    # shellcheck source=scripts/verify-requirements.sh
    source "$ROOT_DIR/scripts/verify-requirements.sh"
    verify_requirements dev "" "auto" || true
  fi

  step "Setup mode: $MODE"

  step 'Phase 2: Backend npm install'
  ( cd "$BACKEND_DIR" && npm install )
  ok 'Backend dependencies installed.'
  step 'Phase 2b: Frontend npm install'
  ( cd "$FRONTEND_DIR" && npm install )
  ok 'Frontend dependencies installed.'

  [[ "$SKIP_MICRO" -eq 0 ]] && build_microservice 0

  step 'Phase 4: Backend .env configuration'
  local advert; advert="$(resolve_advertise_host)"
  local cors="http://localhost:$BACKEND_PORT"
  [[ "$advert" != 'localhost' ]] && cors="$cors,http://$advert:$BACKEND_PORT,http://$advert:$FRONTEND_PORT"
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
    warn 'Existing .env backed up.'
  fi
  {
    echo "PORT=$BACKEND_PORT"
    echo "CORS_ORIGIN=$cors"
    echo 'DB_PATH=./src/db/database.sqlite'
    echo
    echo '# Anthropic Claude integration.'
    if [[ -n "$ANTHROPIC_KEY" ]]; then
      echo "ANTHROPIC_API_KEY=$ANTHROPIC_KEY"
      echo "ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    else
      echo '# ANTHROPIC_API_KEY=sk-ant-...'
      echo "# ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    fi
    echo
    echo '# Microservice integration.'
    echo "NEOTERRITORY_BIN=$BIN_PATH"
    echo "NEOTERRITORY_CATALOG=$MS_DIR/pattern_catalog"
  } >"$ENV_FILE"
  ok ".env written at $ENV_FILE (lan=$([[ "$advert" != 'localhost' ]] && echo true || echo false))"

  if [[ "$MODE" == 'full' ]]; then
    step 'Phase 5: Database warm-up'
    ( cd "$BACKEND_DIR" && node -e "const { initDb } = require('./src/db/initDb'); initDb(); console.log('schema initialized');" )
    ok 'Database schema initialized.'
  fi

  echo
  step 'Setup complete'
  ok "Run dev with:  ./start.sh$([[ "$LAN" -eq 1 ]] && echo ' --lan' || true)"

  if [[ "$AUTO_START" -eq 1 ]]; then
    step 'Starting dev server (--auto-start)'
    local args=(dev --backend-port "$BACKEND_PORT" --frontend-port "$FRONTEND_PORT")
    [[ "$LAN" -eq 1 ]] && args+=(--lan)
    [[ -n "$BIND_HOST" ]] && args+=(--host "$BIND_HOST")
    exec "$0" "${args[@]}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: k8s  (replaces old setup.sh)
# ─────────────────────────────────────────────────────────────────────────────
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
    -f Codebase/Infrastructure/session-orchestration/docker/Dockerfile .

  step 'Applying k8s templates'
  kubectl apply -f Codebase/Infrastructure/session-orchestration/k8s/templates/

  step 'Pod status'
  kubectl get pods
  echo
  echo 'To port-forward a session:'
  echo '  kubectl port-forward pod/neoterritory-session-user123 8080:8080'
}

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: browser  (replaces clean-browser.sh)
# ─────────────────────────────────────────────────────────────────────────────
invoke_browser_inline() {
  local target="$URL_ARG"
  if [[ -z "$target" ]]; then
    local advert; advert="$(resolve_advertise_host)"
    target="http://$advert:$FRONTEND_PORT"
  fi

  local CHROME=''
  if [[ "$USE_PW" -eq 1 ]]; then
    local pw_root="${LOCALAPPDATA:-$HOME/.cache}/ms-playwright"
    local pw_chrome
    pw_chrome="$(ls -d "$pw_root"/chromium-* 2>/dev/null | sort -V | tail -1 || true)"
    if [[ -n "$pw_chrome" ]]; then
      CHROME="$(ls "$pw_chrome"/chrome-win64/chrome.exe "$pw_chrome"/chrome-win/chrome.exe \
                  "$pw_chrome"/chrome-linux/chrome 2>/dev/null | head -1 || true)"
    fi
  fi
  if [[ -z "$CHROME" ]]; then
    for c in \
      "C:/Program Files/Google/Chrome/Application/chrome.exe" \
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
      "C:/Program Files/Chromium/Application/chrome.exe" \
      "$(command -v chromium 2>/dev/null || true)" \
      "$(command -v chromium-browser 2>/dev/null || true)" \
      "$(command -v google-chrome 2>/dev/null || true)"; do
      [[ -n "$c" && -f "$c" ]] && { CHROME="$c"; break; }
    done
  fi
  if [[ -z "$CHROME" || ! -f "$CHROME" ]]; then
    err 'No Chrome/Chromium found. Install Chrome or run: npx playwright install chromium'
    exit 1
  fi

  echo "Browser : $CHROME"
  echo "URL     : $target"
  local PROFILE_DIR; PROFILE_DIR="$(mktemp -d)"
  echo "Profile : $PROFILE_DIR  (deleted on exit)"
  trap 'rm -rf "$PROFILE_DIR"' EXIT

  "$CHROME" \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run --no-default-browser-check --disable-extensions --disable-default-apps \
    --disable-sync --disable-translate --disable-background-networking \
    --disable-background-timer-throttling --disable-backgrounding-occluded-windows \
    --disable-client-side-phishing-detection --disable-component-update --disable-hang-monitor \
    --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost \
    --disable-renderer-backgrounding --disk-cache-size=0 --media-cache-size=0 \
    --disable-application-cache --password-store=basic --use-mock-keychain \
    --metrics-recording-only --safebrowsing-disable-auto-update --incognito \
    "$target"
}

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: test
# ─────────────────────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────────────────────
# Subcommand: deploy (AWS)
# ─────────────────────────────────────────────────────────────────────────────
invoke_deploy() {
  local deploy_script="$ROOT_DIR/scripts/deploy-aws.sh"
  if [[ ! -f "$deploy_script" ]]; then err "Deploy script not found: $deploy_script"; exit 1; fi
  bash "$deploy_script" "${REST_ARGS[@]}"
}

# ─── Dispatch ──────────────────────────────────────────────────────────────
if [[ "$BOTH" -eq 1 ]]; then
  step 'Running BOTH Local and AWS deployment'
  # Start local dev in background without browser
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
