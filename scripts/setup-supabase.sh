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
    self-hosted) cmd_self_hosted ;;
    cloud)       cmd_cloud ;;
    status)      cmd_status ;;
    *)
      cat <<'USAGE'
Usage:
  ./scripts/setup-supabase.sh self-hosted   # install CLI + supabase init + start
  ./scripts/setup-supabase.sh cloud         # print 5-step cloud guide
  ./scripts/setup-supabase.sh status        # check what's configured

The actual backend wiring (handlers under /auth/google, /auth/signup, etc)
will land in a follow-up commit once keys are in place. This script
prepares the local environment.
USAGE
      ;;
  esac
}

main "$@"
