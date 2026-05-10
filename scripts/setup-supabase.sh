#!/usr/bin/env bash
# Setup helper for the upcoming AUTH_PROVIDER=supabase_self_hosted feature.
#
# Two modes the project owner asked for:
#   1. supabase_self_hosted — primary, runs a local Supabase stack via the
#      Supabase CLI. Used during development; survives offline work.
#   2. supabase_cloud       — fallback, uses a project on supabase.com.
#      Picked automatically when the local stack is down.
#
# This script does the install + init. It does NOT paste any keys into
# .env — the project owner explicitly said keys come later. Run it when
# the team is ready to switch off the dev (Devcon) auth path.
#
# Usage:
#   ./scripts/setup-supabase.sh self-hosted   # install CLI + supabase init
#   ./scripts/setup-supabase.sh cloud         # print the 5-step cloud guide
#   ./scripts/setup-supabase.sh status        # check what's configured

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
ENV_FILE="$ROOT/Codebase/Backend/.env"

color() { local code="$1"; shift; printf '\033[%sm%s\033[0m\n' "$code" "$*"; }
info() { color 36 "[setup-supabase] $*"; }
warn() { color 33 "[setup-supabase] $*" >&2; }
err()  { color 31 "[setup-supabase] $*" >&2; }

# Auto-write a key=value pair into ENV_FILE. Replaces an existing entry
# in-place; appends if missing. Backs up to .env.bak on first write per
# invocation so the dev never silently loses local edits.
declare -i BACKUP_DONE=0
ensure_backup() {
  if [[ "$BACKUP_DONE" -eq 1 ]]; then return; fi
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "$ENV_FILE.bak"
    info "backup: $ENV_FILE.bak"
  fi
  BACKUP_DONE=1
}
upsert_env() {
  local key="$1" value="$2"
  ensure_backup
  if [[ -f "$ENV_FILE" ]] && grep -qE "^${key}=" "$ENV_FILE"; then
    # Use a delimiter unlikely to appear in a Supabase URL/key.
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    rm -f "$ENV_FILE.tmp"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  info "wrote $key"
}

cmd_self_hosted() {
  info "Setting up self-hosted Supabase (primary auth path)."

  if ! command -v supabase >/dev/null 2>&1; then
    info "Supabase CLI not found — installing via npm."
    if ! command -v npm >/dev/null 2>&1; then
      err "npm not on PATH. Install Node.js 20+ first, then re-run."
      exit 1
    fi
    npm install -g supabase || npm install supabase
  fi

  info "Initialising Supabase project under $ROOT/supabase/"
  cd "$ROOT"
  if [[ -d supabase ]]; then
    info "supabase/ directory already exists — skipping init."
  else
    supabase init || npx supabase init
  fi

  info "Starting Supabase stack (postgres + auth + studio in Docker)."
  info "First run downloads ~2GB of images. Subsequent runs are fast."
  supabase start || npx supabase start

  # ────────────────────────────────────────────────────────────────────
  # Auto-credential-writeback. The CLI prints API_URL, ANON_KEY,
  # SERVICE_ROLE_KEY in `supabase status -o env`; parse it and append
  # straight into Codebase/Backend/.env so the dev does not have to
  # copy-paste 3 long base64 strings every restart.
  # ────────────────────────────────────────────────────────────────────
  info "Capturing credentials from \`supabase status -o env\`..."
  local STATUS_ENV
  STATUS_ENV="$(supabase status -o env 2>/dev/null || npx supabase status -o env 2>/dev/null || true)"
  if [[ -z "$STATUS_ENV" ]]; then
    warn "supabase status returned nothing — paste the URLs/keys manually."
    return 0
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ROOT/Codebase/Backend/.env.example" ]]; then
      cp "$ROOT/Codebase/Backend/.env.example" "$ENV_FILE"
      info "Bootstrapped $ENV_FILE from .env.example"
    else
      touch "$ENV_FILE"
    fi
  fi

  local API_URL ANON_KEY SERVICE_KEY
  API_URL="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^API_URL=/{print $2}' | tr -d '"' )"
  ANON_KEY="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^ANON_KEY=/{print $2}' | tr -d '"' )"
  SERVICE_KEY="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^SERVICE_ROLE_KEY=/{print $2}' | tr -d '"' )"

  if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
    warn "Could not parse API_URL / ANON_KEY from \`supabase status\`. Manual paste required."
    return 0
  fi

  upsert_env "AUTH_PROVIDER"                  "supabase_self_hosted"
  upsert_env "AUTH_SUPABASE_SELF_HOSTED_URL"  "$API_URL"
  upsert_env "AUTH_SUPABASE_ANON_KEY"         "$ANON_KEY"
  if [[ -n "$SERVICE_KEY" ]]; then
    # Reuse the same SUPABASE_SERVICE_KEY var name the existing log mirror
    # already reads, so a single key powers both auth and the optional
    # admin log mirror without forcing the dev to keep two in sync.
    upsert_env "SUPABASE_SERVICE_KEY"         "$SERVICE_KEY"
    upsert_env "SUPABASE_URL"                 "$API_URL"
  fi

  info ""
  info "Credentials written to $ENV_FILE."
  info "Last step — enable Google OAuth in the Supabase Studio (URL above):"
  info "  Authentication -> Providers -> Google -> enable + paste OAuth client ID/secret."
  info "Then restart the backend: ./start.sh --local"
}

cmd_cloud() {
  cat <<'GUIDE'
[setup-supabase] Cloud setup (fallback path):

  1. Open https://supabase.com and create a free-tier project.
  2. Project Settings -> API -> copy:
       - Project URL                   -> SUPABASE_URL  (already used for log mirroring)
       - anon (public) key             -> AUTH_SUPABASE_ANON_KEY
       - service_role (secret) key     -> SUPABASE_SERVICE_KEY (already used)
  3. Authentication -> Providers -> Google:
       - Enable, paste your Google OAuth client ID + secret
         (https://console.cloud.google.com -> Credentials -> OAuth client ID, web app)
       - Authorized redirect URI:  https://<project>.supabase.co/auth/v1/callback
  4. Set in Codebase/Backend/.env:
       AUTH_PROVIDER=supabase_cloud
       AUTH_SUPABASE_ANON_KEY=...
       AUTH_SUPABASE_GOOGLE_REDIRECT_URL=http://localhost:3001/auth/google/callback
  5. Restart the backend. Sign-in with Google will route through Supabase Auth.

GUIDE
}

cmd_install_gcloud() {
  if command -v gcloud >/dev/null 2>&1; then
    info "gcloud already installed: $(gcloud --version 2>&1 | head -1)"
    return 0
  fi
  info "Installing Google Cloud SDK (gcloud) into ~/google-cloud-sdk..."
  if [[ "${OSTYPE:-}" == darwin* ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install --cask google-cloud-sdk
      return 0
    fi
  fi
  # Linux / WSL fallback — Google's official one-shot installer. Drops
  # the SDK into $HOME/google-cloud-sdk and adds the binaries to the
  # current shell via the install.sh prompt at the end.
  if ! command -v curl >/dev/null 2>&1; then
    err "curl not on PATH. Install curl first, then re-run."
    exit 1
  fi
  curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir="$HOME"
  # shellcheck disable=SC1091
  if [[ -f "$HOME/google-cloud-sdk/path.bash.inc" ]]; then
    source "$HOME/google-cloud-sdk/path.bash.inc"
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    warn "gcloud installed but not on PATH for this shell."
    warn "Add this to your ~/.bashrc:"
    warn "  source \"\$HOME/google-cloud-sdk/path.bash.inc\""
    warn "Then re-open the terminal and re-run this command."
    exit 1
  fi
  info "gcloud ready: $(gcloud --version 2>&1 | head -1)"
}

# Google OAuth client provisioning. The OAuth 2.0 web-app client ID
# Supabase needs (the "Sign in with Google" kind) cannot be CREATED via
# `gcloud` today — Google's CLI only manages workload-identity OAuth
# clients via `gcloud iam oauth-clients`. So this command does what CAN
# be automated: install gcloud, log the user in, list / pick a project,
# enable the IAM API, deep-link straight into the OAuth credentials
# creation page WITH the redirect URI for the local Supabase stack
# pre-baked, and on stdin-paste of the resulting client ID + secret it
# writes them straight into supabase/config.toml so a single
# `supabase stop && supabase start` enables Google sign-in end-to-end.
cmd_google_oauth() {
  cmd_install_gcloud

  if ! gcloud auth list --format='value(account)' 2>/dev/null | grep -q .; then
    info "Authenticating with Google..."
    gcloud auth login --update-adc
  fi

  local project
  project="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -z "$project" || "$project" == "(unset)" ]]; then
    info "No active gcloud project. Pick one (or 'q' to abort):"
    gcloud projects list --format='table(projectId,name)' 2>&1 | head -20
    read -r -p "Project ID: " project
    if [[ -z "$project" || "$project" == "q" ]]; then
      err "Aborted. Run: gcloud projects create <id> if you need a fresh one."
      exit 1
    fi
    gcloud config set project "$project"
  fi
  info "Active gcloud project: $project"

  info "Enabling required APIs (iam, oauth2, iamcredentials)..."
  gcloud services enable iam.googleapis.com iamcredentials.googleapis.com 2>&1 | tail -3 || true

  # Discover the local Supabase callback URL so we can pre-fill the
  # redirect URI. supabase prints the API URL at status -o env; the
  # GoTrue callback path is /auth/v1/callback under that base.
  local SUPABASE_API CALLBACK
  SUPABASE_API="$(supabase status -o env 2>/dev/null | awk -F= '/^API_URL=/{print $2}' | tr -d '"')"
  if [[ -z "$SUPABASE_API" ]]; then
    SUPABASE_API="$(grep -E '^AUTH_SUPABASE_SELF_HOSTED_URL=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)"
  fi
  if [[ -z "$SUPABASE_API" ]]; then
    warn "Could not detect local Supabase API URL. Run 'self-hosted' first."
    exit 1
  fi
  CALLBACK="${SUPABASE_API%/}/auth/v1/callback"
  info "Supabase callback URI:  $CALLBACK"

  cat <<EOM

Manual step (Google won't expose web-app OAuth client creation via CLI):
  1. Opening this URL in your browser:
     https://console.cloud.google.com/apis/credentials/oauthclient?project=$project
  2. Choose 'Web application'.
  3. Authorised redirect URI:
        $CALLBACK
  4. Click Create.
  5. Copy the Client ID and Client Secret it shows you.

EOM
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$project" 2>/dev/null || true
  elif command -v open >/dev/null 2>&1; then
    open "https://console.cloud.google.com/apis/credentials/oauthclient?project=$project" 2>/dev/null || true
  fi

  read -r -p "Paste Client ID:     " GOOGLE_CLIENT_ID
  read -r -s -p "Paste Client Secret: " GOOGLE_CLIENT_SECRET
  echo ""
  if [[ -z "$GOOGLE_CLIENT_ID" || -z "$GOOGLE_CLIENT_SECRET" ]]; then
    err "Empty client ID or secret — aborting without changes."
    exit 1
  fi

  # Patch supabase/config.toml so Google sign-in is enabled the next
  # time `supabase start` boots. Idempotent: replaces an existing
  # [auth.external.google] block in place; appends one when absent.
  local CFG="$ROOT/supabase/config.toml"
  if [[ ! -f "$CFG" ]]; then
    err "$CFG missing — run \`./scripts/setup-supabase.sh self-hosted\` first."
    exit 1
  fi
  # Append-or-replace pattern. We rewrite the whole [auth.external.google]
  # block by deleting any existing one + appending fresh values.
  python3 - "$CFG" "$GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_SECRET" <<'PYEOF'
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
# Drop any existing [auth.external.google] section and following keys
# until the next [section] header.
cfg = re.sub(
    r"\n\[auth\.external\.google\][^\[]*", "\n", cfg, flags=re.DOTALL
)
cfg = cfg.rstrip() + "\n" + block
with open(path, 'w', encoding='utf-8') as f:
    f.write(cfg)
print(f"[setup-supabase] supabase/config.toml updated.")
PYEOF

  # Mirror the same values into Codebase/Backend/.env so the backend
  # has them too (useful if a future server-side route ever needs the
  # client_id, e.g. for ID-token verification).
  upsert_env "GOOGLE_OAUTH_CLIENT_ID"     "$GOOGLE_CLIENT_ID"
  upsert_env "GOOGLE_OAUTH_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
  upsert_env "GOOGLE_OAUTH_REDIRECT_URI"  "$CALLBACK"

  info "Restarting Supabase to apply Google OAuth..."
  cd "$ROOT" && supabase stop || true
  supabase start

  info ""
  info "Google sign-in should now work against the local Supabase stack."
  info "Test by signing in via the studio URL printed above."
}

cmd_setup_all() {
  info "Running full local auth stack setup (Supabase + Google OAuth)..."
  cmd_self_hosted
  cmd_google_oauth
  info ""
  info "Done. Run \`./scripts/setup-supabase.sh status\` to verify."
}

cmd_status() {
  if [[ ! -f "$ENV_FILE" ]]; then
    warn "No $ENV_FILE — copy .env.example to .env first."
    return 0
  fi
  info "AUTH_PROVIDER:                   $(grep -E '^AUTH_PROVIDER=' "$ENV_FILE" || echo '(unset, defaults to dev)')"
  info "SUPABASE_URL:                    $(grep -E '^SUPABASE_URL=' "$ENV_FILE" || echo '(unset)')"
  info "AUTH_SUPABASE_SELF_HOSTED_URL:   $(grep -E '^AUTH_SUPABASE_SELF_HOSTED_URL=' "$ENV_FILE" || echo '(unset)')"
  info "AUTH_SUPABASE_ANON_KEY:          $(grep -E '^AUTH_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | sed 's/=.*/=<set>/' || echo '(unset)')"
  if command -v supabase >/dev/null 2>&1; then
    info "Supabase CLI installed: $(supabase --version 2>&1 | head -1)"
    cd "$ROOT" && supabase status 2>&1 | head -10 || warn "supabase status failed (stack not running?)"
  else
    warn "Supabase CLI not installed."
  fi
}

main() {
  case "${1:-help}" in
    self-hosted)    cmd_self_hosted ;;
    cloud)          cmd_cloud ;;
    google-oauth)   cmd_google_oauth ;;
    install-gcloud) cmd_install_gcloud ;;
    setup-all)      cmd_setup_all ;;
    status)         cmd_status ;;
    *)
      cat <<'USAGE'
Usage:
  ./scripts/setup-supabase.sh setup-all       # install everything + start
                                              # supabase + provision Google
                                              # OAuth in one go (recommended)
  ./scripts/setup-supabase.sh self-hosted     # install supabase CLI + init
                                              # + start + auto-write keys
  ./scripts/setup-supabase.sh google-oauth    # install gcloud + walk through
                                              # OAuth credential creation +
                                              # auto-patch supabase/config.toml
  ./scripts/setup-supabase.sh install-gcloud  # install just the gcloud CLI
  ./scripts/setup-supabase.sh cloud           # print 5-step supabase.com guide
  ./scripts/setup-supabase.sh status          # check what's configured

The full local stack (Supabase Postgres + GoTrue auth + Google OAuth) is
provisioned end-to-end by `setup-all`. Re-running is safe — every step
is idempotent.
USAGE
      ;;
  esac
}

main "$@"
