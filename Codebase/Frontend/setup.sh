#!/usr/bin/env bash
# Frontend bootstrap — static SPA. No build step today; the Backend serves
# these files. On a separate device, point a static host (nginx/caddy) here
# and set window.API_BASE in your env to the Backend URL.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

say() { printf "\033[1;35m[frontend]\033[0m %s\n" "$*"; }

REQUIRED=(index.html admin.html app.js admin.js styles.css admin.css)
missing=0
for f in "${REQUIRED[@]}"; do
  [ -f "$f" ] || { say "MISSING $f"; missing=1; }
done
[ "$missing" -eq 0 ] || { say "Frontend assets incomplete. Re-clone the repo."; exit 1; }

say "Static assets present:"
ls -1 *.html *.js *.css 2>/dev/null | sed 's/^/  - /'

# Optional: serve standalone for separate-device demo (port 8080).
if command -v python3 >/dev/null 2>&1; then
  say "Standalone preview command:  python3 -m http.server 8080"
elif command -v npx >/dev/null 2>&1; then
  say "Standalone preview command:  npx --yes serve -p 8080 ."
else
  say "Install python3 or npx to preview standalone; otherwise the Backend serves these files."
fi

say "Done. Single-device dev: just run Backend — it serves this folder."
