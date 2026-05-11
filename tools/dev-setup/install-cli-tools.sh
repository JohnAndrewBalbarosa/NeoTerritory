#!/usr/bin/env bash
# Standalone CLI installer for the NeoTerritory local-replication path.
# Optional — the default Devcon test-account flow does not need any of
# this. Run only when you want to mirror the project owner's
# Supabase + Google sign-in stack locally.
#
# Installs (idempotent — safe to re-run):
#   - gcloud (Google Cloud SDK)
#   - jq (JSON parser, used by provision-google-oauth.sh)
#   - supabase (Supabase CLI)
#
# Project-agnostic: nothing here writes into the repo. Future projects
# can run this same script verbatim.

set -euo pipefail

color() { local code="$1"; shift; printf '\033[%sm%s\033[0m\n' "$code" "$*"; }
info() { color 36 "[install-cli] $*"; }
warn() { color 33 "[install-cli] $*" >&2; }
err()  { color 31 "[install-cli] $*" >&2; }
ok()   { color 32 "[install-cli] $*"; }

install_gcloud() {
  if command -v gcloud >/dev/null 2>&1; then
    ok "gcloud already installed: $(gcloud --version 2>&1 | head -1)"
    return 0
  fi
  info "Installing Google Cloud SDK..."
  if [[ "${OSTYPE:-}" == darwin* ]] && command -v brew >/dev/null 2>&1; then
    brew install --cask google-cloud-sdk
  else
    if ! command -v curl >/dev/null 2>&1; then
      err "curl missing — install curl, then re-run."; exit 1
    fi
    curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir="$HOME"
    # shellcheck disable=SC1091
    [[ -f "$HOME/google-cloud-sdk/path.bash.inc" ]] && source "$HOME/google-cloud-sdk/path.bash.inc"
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    warn "gcloud installed but not on PATH for this shell."
    warn "Add to ~/.bashrc:  source \"\$HOME/google-cloud-sdk/path.bash.inc\""
    warn "Then re-open the terminal."
    return 1
  fi
  ok "gcloud ready: $(gcloud --version 2>&1 | head -1)"
}

install_jq() {
  if command -v jq >/dev/null 2>&1; then
    ok "jq already installed: $(jq --version 2>&1)"
    return 0
  fi
  info "Installing jq..."
  if [[ "${OSTYPE:-}" == darwin* ]] && command -v brew >/dev/null 2>&1; then
    brew install jq
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y && sudo apt-get install -y jq
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y jq
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --noconfirm jq
  else
    warn "Couldn't find a package manager to install jq. Install it manually."
    return 1
  fi
  ok "jq ready: $(jq --version 2>&1)"
}

install_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    ok "supabase already installed: $(supabase --version 2>&1 | head -1)"
    return 0
  fi
  info "Installing Supabase CLI..."
  if ! command -v npm >/dev/null 2>&1; then
    err "npm missing — install Node.js 20+, then re-run."; exit 1
  fi
  npm install -g supabase || npm install supabase
  ok "supabase ready: $(supabase --version 2>&1 | head -1)"
}

main() {
  install_gcloud || true
  install_jq || true
  install_supabase || true
  echo ""
  ok "Done. Next: ./tools/dev-setup/provision-google-oauth.sh login"
}
main "$@"
