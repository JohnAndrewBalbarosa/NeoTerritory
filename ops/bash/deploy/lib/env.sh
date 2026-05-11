#!/usr/bin/env bash
# Loads scripts/.env.deploy and provides the y/N prompt helper.

load_deploy_env() {
  local env_file="$1"
  if [ ! -f "$env_file" ]; then
    echo "ERROR: missing $env_file" >&2; return 1
  fi
  chmod 600 "$env_file" 2>/dev/null || true
  # Safe line-by-line parser — handles unquoted multi-word values like
  #   TEST_RUNNER_SANDBOX=firejail --quiet --net=none ...
  # which `set -a; source` would misparse (bash treats each space-separated
  # word after the first as a command to execute, producing "command not found").
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      # Strip surrounding double or single quotes if present.
      if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then
        val="${BASH_REMATCH[1]}"
      fi
      export "$key"="$val"
    fi
  done < "$env_file"
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
