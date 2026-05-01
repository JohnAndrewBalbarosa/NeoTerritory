#!/usr/bin/env bash
# Launch a completely isolated Chromium with no cache, no cookies, no history.
# Each run gets a fresh temp profile that is deleted when the browser closes.
#
# Usage:
#   ./clean-browser.sh                        # opens http://localhost:3001
#   ./clean-browser.sh http://localhost:5173  # opens a specific URL
#   ./clean-browser.sh --pw                   # use Playwright's Chromium instead of system Chrome
#   ./clean-browser.sh --pw http://localhost:3001

set -euo pipefail

# ── pick binary ──────────────────────────────────────────────────────────────

USE_PW=0
URL="http://localhost:3001"

for arg in "$@"; do
  case "$arg" in
    --pw) USE_PW=1 ;;
    http*) URL="$arg" ;;
  esac
done

if [[ $USE_PW -eq 1 ]]; then
  # Prefer the newest Playwright Chromium build
  PW_CHROME=$(ls -d "$LOCALAPPDATA/ms-playwright/chromium-"* 2>/dev/null \
    | sort -V | tail -1)
  if [[ -z "$PW_CHROME" ]]; then
    echo "ERROR: No Playwright Chromium found. Run: npx playwright install chromium" >&2
    exit 1
  fi
  # Try chrome-win64 first (newer builds), fall back to chrome-win
  CHROME=$(ls "$PW_CHROME/chrome-win64/chrome.exe" \
               "$PW_CHROME/chrome-win/chrome.exe" 2>/dev/null | head -1)
else
  # System Chrome / Chromium candidates
  for candidate in \
    "C:/Program Files/Google/Chrome/Application/chrome.exe" \
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
    "C:/Program Files/Chromium/Application/chrome.exe" \
    "$(command -v chromium 2>/dev/null)" \
    "$(command -v chromium-browser 2>/dev/null)"; do
    if [[ -f "$candidate" ]]; then
      CHROME="$candidate"
      break
    fi
  done
fi

if [[ -z "${CHROME:-}" || ! -f "$CHROME" ]]; then
  echo "ERROR: No Chrome/Chromium found. Install it or use --pw for Playwright's build." >&2
  exit 1
fi

echo "Browser : $CHROME"
echo "URL     : $URL"

# ── fresh temp profile ────────────────────────────────────────────────────────

PROFILE_DIR=$(mktemp -d)
echo "Profile : $PROFILE_DIR  (deleted on exit)"

# Delete the temp dir when the script exits (browser has closed)
trap 'rm -rf "$PROFILE_DIR"' EXIT

# ── launch ───────────────────────────────────────────────────────────────────

"$CHROME" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-extensions \
  --disable-default-apps \
  --disable-sync \
  --disable-translate \
  --disable-background-networking \
  --disable-background-timer-throttling \
  --disable-backgrounding-occluded-windows \
  --disable-client-side-phishing-detection \
  --disable-component-update \
  --disable-hang-monitor \
  --disable-ipc-flooding-protection \
  --disable-popup-blocking \
  --disable-prompt-on-repost \
  --disable-renderer-backgrounding \
  --disk-cache-size=0 \
  --media-cache-size=0 \
  --disable-application-cache \
  --password-store=basic \
  --use-mock-keychain \
  --metrics-recording-only \
  --safebrowsing-disable-auto-update \
  --incognito \
  "$URL"
