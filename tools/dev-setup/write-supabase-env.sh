#!/usr/bin/env bash
# Capture `supabase status -o env` and write the values straight into
# the project's .env. Idempotent — replaces existing keys in place.
# Belongs under tools/dev-setup so other devs can run it themselves
# after their own `supabase start`.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="${1:-$ROOT/Codebase/Backend/.env}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not on PATH" >&2
  exit 1
fi

upsert() {
  local key="$1" value="$2"
  if [[ -f "$ENV_FILE" ]] && grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
  echo "wrote $key"
}

STATUS_ENV="$(supabase status -o env 2>/dev/null)"
API_URL="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^API_URL=/{gsub(/"/,"",$2); print $2}')"
ANON_KEY="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^ANON_KEY=/{gsub(/"/,"",$2); print $2}')"
SERVICE_ROLE_KEY="$(printf '%s\n' "$STATUS_ENV" | awk -F= '/^SERVICE_ROLE_KEY=/{gsub(/"/,"",$2); print $2}')"

if [[ -z "$API_URL" || -z "$ANON_KEY" ]]; then
  echo "Could not parse API_URL/ANON_KEY. Is supabase running?" >&2
  exit 1
fi

upsert AUTH_PROVIDER                  supabase_self_hosted
upsert AUTH_SUPABASE_SELF_HOSTED_URL  "$API_URL"
upsert AUTH_SUPABASE_ANON_KEY         "$ANON_KEY"
upsert SUPABASE_URL                   "$API_URL"
[[ -n "$SERVICE_ROLE_KEY" ]] && upsert SUPABASE_SERVICE_KEY "$SERVICE_ROLE_KEY"

echo "Done. Restart the backend to pick up the new auth provider."
