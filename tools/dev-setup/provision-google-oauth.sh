#!/usr/bin/env bash
# Google OAuth provisioning helper — automates everything Google does
# allow programmatically, and reduces the one manual step (web-app
# OAuth 2.0 client creation) to "download a JSON file once".
#
# Standalone + reusable for future projects. Defaults match the
# NeoTerritory layout (Codebase/Backend/.env + ./supabase/config.toml);
# every path is overridable via flags.
#
# Subcommands:
#   login                gcloud auth login + ADC
#   project              pick / create the active gcloud project
#   enable-apis          enable iam, iamcredentials, cloudresourcemanager
#   open-creation-page   open the OAuth credentials page in your browser
#                        with the local Supabase callback URI pre-baked,
#                        so you click "Web app" -> Create -> Download JSON
#   from-json            read a downloaded client_secret_*.json and
#                        write GOOGLE_OAUTH_CLIENT_ID / _SECRET /
#                        _REDIRECT_URI into the env file + patch the
#                        supabase/config.toml [auth.external.google]
#                        block in place (idempotent)
#   status               show what's installed / configured
#
# Flags:
#   --env-file <path>          target .env (default: Codebase/Backend/.env)
#   --supabase-config <path>   supabase/config.toml (default: ./supabase/config.toml)
#   --redirect <url>           OAuth callback URI to register
#                              (default: probe `supabase status`, then env)
#   --json <path>              client_secret_*.json downloaded from Cloud Console
#   --project <id>             override active gcloud project

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

ENV_FILE="$ROOT/Codebase/Backend/.env"
SUPABASE_CONFIG="$ROOT/supabase/config.toml"
REDIRECT_URI=""
JSON_PATH=""
PROJECT_OVERRIDE=""

color() { local code="$1"; shift; printf '\033[%sm%s\033[0m\n' "$code" "$*"; }
info() { color 36 "[google-oauth] $*"; }
warn() { color 33 "[google-oauth] $*" >&2; }
err()  { color 31 "[google-oauth] $*" >&2; }
ok()   { color 32 "[google-oauth] $*"; }

parse_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env-file)        ENV_FILE="$2"; shift 2 ;;
      --supabase-config) SUPABASE_CONFIG="$2"; shift 2 ;;
      --redirect)        REDIRECT_URI="$2"; shift 2 ;;
      --json)            JSON_PATH="$2"; shift 2 ;;
      --project)         PROJECT_OVERRIDE="$2"; shift 2 ;;
      *) err "Unknown flag: $1"; exit 2 ;;
    esac
  done
}

require_gcloud() {
  if ! command -v gcloud >/dev/null 2>&1; then
    err "gcloud not on PATH. Run ./tools/dev-setup/install-cli-tools.sh first."
    exit 1
  fi
}
require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    err "jq not on PATH. Run ./tools/dev-setup/install-cli-tools.sh first."
    exit 1
  fi
}

# Atomic per-key upsert into ENV_FILE. Replaces existing entries in-place;
# appends new ones. Backs up to .env.bak.<timestamp> on first write per
# invocation so manual edits aren't silently overwritten.
declare -i BACKUP_DONE=0
ensure_env_backup() {
  if [[ "$BACKUP_DONE" -eq 1 ]]; then return; fi
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
    info "backup: $ENV_FILE.bak.<timestamp>"
  fi
  BACKUP_DONE=1
}
upsert_env() {
  local key="$1" value="$2"
  ensure_env_backup
  mkdir -p "$(dirname "$ENV_FILE")"
  if [[ ! -f "$ENV_FILE" ]]; then : > "$ENV_FILE"; fi
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    rm -f "$ENV_FILE.tmp"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  info "wrote $key"
}

# Detect callback URI: --redirect flag wins, else probe `supabase status`,
# else read AUTH_SUPABASE_SELF_HOSTED_URL from $ENV_FILE, else default
# to the Supabase CLI default (localhost:54321).
detect_callback() {
  if [[ -n "$REDIRECT_URI" ]]; then printf '%s\n' "$REDIRECT_URI"; return 0; fi
  local api=""
  if command -v supabase >/dev/null 2>&1; then
    api="$(supabase status -o env 2>/dev/null | awk -F= '/^API_URL=/{print $2}' | tr -d '"')"
  fi
  if [[ -z "$api" && -f "$ENV_FILE" ]]; then
    api="$(grep -E '^AUTH_SUPABASE_SELF_HOSTED_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  fi
  [[ -z "$api" ]] && api="http://127.0.0.1:54321"
  printf '%s/auth/v1/callback\n' "${api%/}"
}

cmd_login() {
  require_gcloud
  if gcloud auth list --format='value(account)' --filter=status:ACTIVE 2>/dev/null | grep -q .; then
    ok "Already authenticated: $(gcloud auth list --format='value(account)' --filter=status:ACTIVE | head -1)"
  else
    info "Opening browser-based gcloud login..."
    gcloud auth login --update-adc
  fi
  if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
    info "Setting up Application Default Credentials..."
    gcloud auth application-default login
  fi
  ok "gcloud authenticated."
}

cmd_project() {
  require_gcloud
  local project="${PROJECT_OVERRIDE:-}"
  [[ -z "$project" ]] && project="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -z "$project" || "$project" == "(unset)" ]]; then
    info "Available projects:"
    gcloud projects list --format='table(projectId,name,createTime)' 2>&1 | head -20
    read -r -p "Project ID (or 'new <id> <name>' to create): " input
    if [[ "$input" =~ ^new[[:space:]]+([a-z0-9-]+)[[:space:]]+(.+)$ ]]; then
      gcloud projects create "${BASH_REMATCH[1]}" --name="${BASH_REMATCH[2]}"
      project="${BASH_REMATCH[1]}"
    else
      project="$input"
    fi
    [[ -z "$project" ]] && { err "No project chosen."; exit 1; }
  fi
  gcloud config set project "$project"
  ok "Active project: $project"
}

cmd_enable_apis() {
  require_gcloud
  info "Enabling APIs (iam, iamcredentials, cloudresourcemanager)..."
  gcloud services enable \
    iam.googleapis.com \
    iamcredentials.googleapis.com \
    cloudresourcemanager.googleapis.com \
    2>&1 | tail -5 || true
  ok "API enablement done."
}

cmd_open_creation_page() {
  require_gcloud
  local project
  project="$(gcloud config get-value project 2>/dev/null || echo '')"
  if [[ -z "$project" || "$project" == "(unset)" ]]; then
    err "No active gcloud project. Run: $(basename "$0") project"
    exit 1
  fi
  local cb
  cb="$(detect_callback)"
  cat <<EOM

Manual click (Google does not yet expose web-app OAuth 2.0 client
creation via API):

  1. Browser is opening:
     https://console.cloud.google.com/apis/credentials/oauthclient?project=$project
  2. Application type:        Web application
  3. Authorised redirect URI: $cb
  4. Click Create.
  5. In the dialog, click "Download JSON". Save it anywhere.
  6. Re-run this script with the downloaded path:
       $(basename "$0") from-json --json /path/to/client_secret_xxx.json

EOM
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$project" 2>/dev/null || true
  elif command -v open >/dev/null 2>&1; then
    open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$project" 2>/dev/null || true
  fi
}

cmd_from_json() {
  require_jq
  if [[ -z "$JSON_PATH" || ! -f "$JSON_PATH" ]]; then
    err "Provide the downloaded credentials JSON via --json <path>."
    exit 1
  fi
  local cid secret rurl
  cid="$(jq -r '.web.client_id // .installed.client_id // empty' "$JSON_PATH")"
  secret="$(jq -r '.web.client_secret // .installed.client_secret // empty' "$JSON_PATH")"
  rurl="$(jq -r '.web.redirect_uris[0] // empty' "$JSON_PATH")"
  if [[ -z "$cid" || -z "$secret" ]]; then
    err "JSON did not contain client_id + client_secret."
    exit 1
  fi
  [[ -z "$rurl" ]] && rurl="$(detect_callback)"
  upsert_env GOOGLE_OAUTH_CLIENT_ID     "$cid"
  upsert_env GOOGLE_OAUTH_CLIENT_SECRET "$secret"
  upsert_env GOOGLE_OAUTH_REDIRECT_URI  "$rurl"

  if [[ -f "$SUPABASE_CONFIG" ]]; then
    info "Patching $SUPABASE_CONFIG [auth.external.google]..."
    python3 - "$SUPABASE_CONFIG" "$cid" "$secret" <<'PYEOF'
import re, sys
path, cid, secret = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding='utf-8') as f:
    cfg = f.read()
block = (
    "\n[auth.external.google]\n"
    "enabled = true\n"
    f'client_id = "{cid}"\n'
    f'secret = "{secret}"\n'
    'redirect_uri = ""\n'
    'url = ""\n'
    "skip_nonce_check = false\n"
)
cfg = re.sub(r"\n\[auth\.external\.google\][^\[]*", "\n", cfg, flags=re.DOTALL)
cfg = cfg.rstrip() + "\n" + block
with open(path, 'w', encoding='utf-8') as f:
    f.write(cfg)
print("[google-oauth] supabase/config.toml updated.")
PYEOF
    if command -v supabase >/dev/null 2>&1; then
      info "Restart Supabase to pick up the new provider:"
      info "  supabase stop && supabase start"
    fi
  else
    warn "$SUPABASE_CONFIG not found — wrote env only."
    warn "(If you don't run Supabase, paste the values into your auth provider manually.)"
  fi
  ok "Google OAuth credentials provisioned."
}

cmd_status() {
  echo "=== CLIs ==="
  for tool in gcloud supabase jq node npm; do
    if command -v "$tool" >/dev/null 2>&1; then
      ok "$tool: $($tool --version 2>&1 | head -1)"
    else
      warn "$tool: not installed"
    fi
  done
  echo "=== gcloud ==="
  if command -v gcloud >/dev/null 2>&1; then
    gcloud auth list --format='value(account,status)' 2>&1 | head -3 || true
    echo "  project = $(gcloud config get-value project 2>&1)"
  fi
  echo "=== env file ==="
  if [[ -f "$ENV_FILE" ]]; then
    for key in GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_OAUTH_REDIRECT_URI \
               AUTH_SUPABASE_SELF_HOSTED_URL AUTH_SUPABASE_ANON_KEY; do
      line="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1)"
      if [[ -n "$line" ]]; then
        case "$key" in
          *KEY*|*SECRET*) printf '  %s=<set>\n' "$key" ;;
          *)              printf '  %s\n' "$line" ;;
        esac
      else
        printf '  %s=(unset)\n' "$key"
      fi
    done
  else
    warn "no $ENV_FILE"
  fi
}

SUBCMD="${1:-help}"
shift || true
parse_flags "$@"

case "$SUBCMD" in
  login)              cmd_login ;;
  project)            cmd_project ;;
  enable-apis)        cmd_enable_apis ;;
  open-creation-page) cmd_open_creation_page ;;
  from-json)          cmd_from_json ;;
  status)             cmd_status ;;
  *)
    cat <<USAGE
provision-google-oauth.sh — Google OAuth credential automation.

Run in this order for a fresh setup:

  ./tools/dev-setup/install-cli-tools.sh                        # one time
  ./tools/dev-setup/provision-google-oauth.sh login
  ./tools/dev-setup/provision-google-oauth.sh project
  ./tools/dev-setup/provision-google-oauth.sh enable-apis
  ./tools/dev-setup/provision-google-oauth.sh open-creation-page
  # ... click Web app + Create + Download JSON ...
  ./tools/dev-setup/provision-google-oauth.sh from-json --json ~/Downloads/client_secret_xxx.json

  ./tools/dev-setup/provision-google-oauth.sh status            # diagnostic

Flags:
  --env-file <path>          (default: Codebase/Backend/.env)
  --supabase-config <path>   (default: ./supabase/config.toml)
  --redirect <url>
  --json <path>
  --project <id>

Reusable across projects: pass --env-file and --supabase-config to point
at the new project's paths.
USAGE
    ;;
esac
