#!/usr/bin/env bash
# Upload aws_deploy_env.secret to the GitHub Actions repo secret
# AWS_DEPLOY_ENV (and AWS_SSH_PRIVATE_KEY when --with-ssh-key is given)
# so the deploy-aws CI job picks them up on the next push.
#
# Why this exists: every credential rotation (Supabase keys,
# GOOGLE_OAUTH_*, GEMINI_API_KEY, JWT_SECRET) requires that the env
# blob the CI runner sees is in sync with the local file. Forgetting
# this is the most common deploy regression — CI deploys an old env
# blob, AWS picks it up, /auth/google/status flips back to
# configured: false until the secret is refreshed.
#
# Idempotent. Refuses to upload if obvious placeholders remain
# (xxxxxxxx, your-key, change-me) or if the file is empty. Pre-flight
# checks gh auth + repo binding so a stale auth token does not silently
# write to the wrong repo.
#
# Usage:
#   ./tools/dev-setup/sync-aws-secret.sh                  # AWS_DEPLOY_ENV only
#   ./tools/dev-setup/sync-aws-secret.sh --with-ssh-key   # also upload AWS_SSH_PRIVATE_KEY
#   ./tools/dev-setup/sync-aws-secret.sh --dry-run        # show what would happen
#   ./tools/dev-setup/sync-aws-secret.sh --file path/.secret  # alt env file path

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="$ROOT/aws_deploy_env.secret"
WITH_SSH=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)         ENV_FILE="$2"; shift 2 ;;
    --with-ssh-key) WITH_SSH=1; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

color() { local code="$1"; shift; printf '\033[%sm%s\033[0m\n' "$code" "$*"; }
info() { color 36 "[sync-aws-secret] $*"; }
warn() { color 33 "[sync-aws-secret] $*" >&2; }
err()  { color 31 "[sync-aws-secret] $*" >&2; }
ok()   { color 32 "[sync-aws-secret] $*"; }

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    err "gh CLI not on PATH. Install: https://cli.github.com/"
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    err "gh not authenticated. Run: gh auth login"
    exit 1
  fi
}

current_repo() {
  # Repo binding from .git/config — the same one gh defaults to.
  gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null
}

# Validate that the file looks production-ready. Flags placeholders,
# empty key=value pairs, and accidental committed-format markers like
# "<paste>" / "TODO". Still allows blank lines and # comments.
validate_env_file() {
  local f="$1"
  if [[ ! -s "$f" ]]; then
    err "Env file is missing or empty: $f"
    exit 1
  fi
  local placeholders
  placeholders=$(grep -nEi 'xxxxxxxx|your[-_]?key|change[-_]?me|<paste>|<placeholder>|TODO[-_]?CHANGE' "$f" || true)
  if [[ -n "$placeholders" ]]; then
    warn "Placeholder text found — refusing to upload until resolved:"
    printf '%s\n' "$placeholders" >&2
    exit 1
  fi
  # Each non-comment line should be KEY=value (allowed: empty value).
  local bad
  bad=$(grep -nE '^[^#[:space:]]' "$f" | grep -vE '^[0-9]+:[A-Za-z_][A-Za-z0-9_]*=' || true)
  if [[ -n "$bad" ]]; then
    warn "Non-KEY=value lines found:"
    printf '%s\n' "$bad" >&2
    exit 1
  fi
}

# Show a redacted preview of what will be uploaded so the operator can
# eyeball it before pulling the trigger. Keys-only output; values are
# never printed (they're secret).
preview_keys() {
  local f="$1"
  info "Keys that will be uploaded to AWS_DEPLOY_ENV:"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$f" | awk -F= '{ printf "  %-30s = %s\n", $1, ($2=="" ? "(empty)" : "<set>") }'
}

main() {
  require_gh
  if [[ ! -f "$ENV_FILE" ]]; then
    err "$ENV_FILE missing. Copy from aws_deploy_env.secret.example or paste your real values."
    exit 1
  fi
  validate_env_file "$ENV_FILE"

  local repo
  repo="$(current_repo || true)"
  if [[ -z "$repo" ]]; then
    err "Cannot detect current GitHub repo. Run from a clone with origin set."
    exit 1
  fi
  info "target repo: $repo"
  info "env file:    $ENV_FILE"
  preview_keys "$ENV_FILE"

  if [[ "$DRY_RUN" -eq 1 ]]; then
    ok "dry-run: would upload AWS_DEPLOY_ENV"
    [[ "$WITH_SSH" -eq 1 ]] && ok "dry-run: would upload AWS_SSH_PRIVATE_KEY from \$HOME/.ssh/lightsail_neoterritory"
    exit 0
  fi

  info "Uploading AWS_DEPLOY_ENV..."
  gh secret set AWS_DEPLOY_ENV --repo "$repo" < "$ENV_FILE"
  ok "AWS_DEPLOY_ENV synced."

  if [[ "$WITH_SSH" -eq 1 ]]; then
    local ssh_key="$HOME/.ssh/lightsail_neoterritory"
    if [[ ! -f "$ssh_key" ]]; then
      err "SSH key missing: $ssh_key"
      exit 1
    fi
    info "Uploading AWS_SSH_PRIVATE_KEY from $ssh_key..."
    gh secret set AWS_SSH_PRIVATE_KEY --repo "$repo" < "$ssh_key"
    ok "AWS_SSH_PRIVATE_KEY synced."
  fi

  ok "Done. Next push to main triggers deploy-aws with the fresh env."
}

main "$@"
