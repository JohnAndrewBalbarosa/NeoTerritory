#!/usr/bin/env bash
# Loads scripts/.env.deploy and provides the y/N prompt helper.

load_deploy_env() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo "ERROR: missing $env_file" >&2; return 1
  fi
  chmod 600 "$env_file" 2>/dev/null || true
  set -a; . "$env_file"; set +a
}

# ASSUME_YES is set by the caller. ask_yes consults it before prompting.
ask_yes() {
  if [ "${ASSUME_YES:-0}" = 1 ]; then
    echo "$1 [auto-yes]"
    return 0
  fi
  printf '%s ' "$1"
  local reply
  if [ -r /dev/tty ]; then
    read -r reply < /dev/tty
  else
    read -r reply
  fi
  [[ "$reply" =~ ^[yY]$ ]]
}
