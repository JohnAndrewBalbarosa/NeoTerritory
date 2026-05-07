#!/usr/bin/env bash
# Detect and free dev ports (BACKEND_PORT, FRONTEND_PORT) before starting
# the local dev stack. Without this, a stale `tsx watch` from a prior
# session, a leftover Vite, or the long-running `neoterritory` Docker
# container silently re-takes :3001 / :5173 and the new backend either
# fails to bind or quietly answers a different process's traffic.
#
# Behaviour:
#   - Default (no flag): probe both ports; if held, print a clear warning
#     telling the user exactly what holds the port and how to free it.
#     Never kills anything implicitly.
#   - --free-ports:       auto-stop OUR processes / OUR Docker container
#                         (image starts with `neoterritory`). Refuses to
#                         touch foreign processes / foreign containers.
#   - --free-ports=force: also kill foreign holders. Use with care.

# Print "kind:detail" describing what holds $1, or empty if free.
#   docker:<container>          — published by a Docker container
#   pid:<pid>:<comm>            — held by a host process owned by us
#   foreign:<pid>:<comm>        — held by another user / system process
port_holder() {
  local port="$1"
  # Check Docker first. A published container port shows up in ss as a
  # host-side proxy whose pid is inaccessible from outside its netns,
  # which would falsely classify the holder as `foreign:?:unknown` and
  # block --free-ports. Docker's view is authoritative for that case.
  if command -v docker >/dev/null 2>&1; then
    local dline
    dline="$(docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null \
              | awk -F'|' -v p=":$port->" '$3 ~ p {print $1 "|" $2; exit}')"
    if [[ -n "$dline" ]]; then
      echo "docker:$dline"
      return 0
    fi
  fi
  if command -v ss >/dev/null 2>&1; then
    local ss_line
    ss_line="$(ss -tlnpH 2>/dev/null | awk -v p=":$port$" '$4 ~ p {print; exit}')"
    if [[ -n "$ss_line" ]]; then
      local pid
      pid="$(printf '%s' "$ss_line" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)"
      if [[ -n "$pid" && -r "/proc/$pid/comm" ]]; then
        local comm
        comm="$(cat /proc/$pid/comm 2>/dev/null || echo unknown)"
        if [[ -O "/proc/$pid" ]]; then
          echo "pid:$pid:$comm"
        else
          echo "foreign:$pid:$comm"
        fi
        return 0
      fi
      echo "foreign:?:unknown"
      return 0
    fi
  fi
  echo ''
}

# Try to free $1. Force mode (FREE_PORTS_FORCE=1) extends the kill set
# to foreign processes and non-neoterritory containers.
free_port() {
  local port="$1"
  local force="${FREE_PORTS_FORCE:-0}"

  local holder
  holder="$(port_holder "$port")"
  [[ -z "$holder" ]] && return 0

  local kind="${holder%%:*}" rest="${holder#*:}"
  case "$kind" in
    pid)
      local pid="${rest%%:*}" comm="${rest#*:}"
      step "Freeing :$port — killing host pid $pid ($comm)"
      kill "$pid" 2>/dev/null || true
      sleep 1
      [[ -d "/proc/$pid" ]] && kill -9 "$pid" 2>/dev/null || true
      ;;
    docker)
      local name="${rest%%|*}" image="${rest#*|}"
      if [[ "$force" -eq 1 || "$image" == neoterritory* ]]; then
        step "Freeing :$port — stopping Docker container '$name' (image: $image)"
        docker stop "$name" >/dev/null 2>&1 || true
      else
        warn "Skipping :$port — held by foreign container '$name' (image: $image)."
        warn "  Re-run with --free-ports=force to stop it, or 'docker stop $name' manually."
        return 1
      fi
      ;;
    foreign)
      local pid="${rest%%:*}" comm="${rest#*:}"
      if [[ "$force" -eq 1 ]]; then
        step "Freeing :$port — killing foreign pid $pid ($comm) [--free-ports=force]"
        kill -9 "$pid" 2>/dev/null || true
      else
        warn "Skipping :$port — held by foreign pid $pid ($comm)."
        warn "  Re-run with --free-ports=force to kill it, or stop it manually."
        return 1
      fi
      ;;
    *)
      warn "Unknown holder kind for :$port — '$holder'"
      return 1
      ;;
  esac

  sleep 1
  local after
  after="$(port_holder "$port")"
  if [[ -n "$after" ]]; then
    err "Port :$port still held after free attempt: $after"
    return 1
  fi
  ok ":$port freed."
  return 0
}

# Wrapper called from dev.sh before start_backend / start_vite.
ensure_port_free() {
  local port="$1" label="$2"
  local holder
  holder="$(port_holder "$port")"
  [[ -z "$holder" ]] && return 0

  if [[ "${FREE_PORTS:-0}" -eq 1 ]]; then
    free_port "$port" || return 1
  else
    warn "Port :$port already in use ($holder) — $label may fail to bind."
    warn "  Re-run with --free-ports to auto-free our own holders,"
    warn "  or with --free-ports=force to also stop foreign ones."
  fi
  return 0
}
