#!/usr/bin/env bash
# LAN / host resolution + WSL2 detection + URL polling.

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
