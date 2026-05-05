#!/usr/bin/env bash
# `start.sh browser` — clean Chromium launcher (replaces clean-browser.sh).

invoke_browser_inline() {
  local target="$URL_ARG"
  if [[ -z "$target" ]]; then
    local advert; advert="$(resolve_advertise_host)"
    target="http://$advert:$FRONTEND_PORT"
  fi

  local CHROME; CHROME="$(find_chrome)"
  if [[ -z "$CHROME" || ! -f "$CHROME" ]]; then
    err 'No Chrome/Chromium found. Install Chrome or run: npx playwright install chromium'
    exit 1
  fi

  echo "Browser : $CHROME"
  echo "URL     : $target"
  local PROFILE_DIR; PROFILE_DIR="$(mktemp -d)"
  echo "Profile : $PROFILE_DIR  (deleted on exit)"
  trap 'rm -rf "$PROFILE_DIR"' EXIT

  "$CHROME" \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run --no-default-browser-check --disable-extensions --disable-default-apps \
    --disable-sync --disable-translate --disable-background-networking \
    --disable-background-timer-throttling --disable-backgrounding-occluded-windows \
    --disable-client-side-phishing-detection --disable-component-update --disable-hang-monitor \
    --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost \
    --disable-renderer-backgrounding --disk-cache-size=0 --media-cache-size=0 \
    --disable-application-cache --password-store=basic --use-mock-keychain \
    --metrics-recording-only --safebrowsing-disable-auto-update --incognito \
    "$target"
}

find_chrome() {
  local chrome=''
  if [[ "$USE_PW" -eq 1 ]]; then
    local pw_root="${LOCALAPPDATA:-$HOME/.cache}/ms-playwright"
    local pw_chrome
    pw_chrome="$(ls -d "$pw_root"/chromium-* 2>/dev/null | sort -V | tail -1 || true)"
    if [[ -n "$pw_chrome" ]]; then
      chrome="$(ls "$pw_chrome"/chrome-win64/chrome.exe "$pw_chrome"/chrome-win/chrome.exe \
                  "$pw_chrome"/chrome-linux/chrome 2>/dev/null | head -1 || true)"
    fi
  fi
  if [[ -z "$chrome" ]]; then
    for c in \
      "C:/Program Files/Google/Chrome/Application/chrome.exe" \
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
      "C:/Program Files/Chromium/Application/chrome.exe" \
      "$(command -v chromium 2>/dev/null || true)" \
      "$(command -v chromium-browser 2>/dev/null || true)" \
      "$(command -v google-chrome 2>/dev/null || true)"; do
      [[ -n "$c" && -f "$c" ]] && { chrome="$c"; break; }
    done
  fi
  echo "$chrome"
}
