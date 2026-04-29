#!/usr/bin/env bash
# Backend bootstrap — installs Node deps, prepares .env, initializes SQLite.
# Run on the device that will host the API server.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

say() { printf "\033[1;36m[backend]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[backend] %s\033[0m\n" "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "node not found. Install Node.js 18+ first (e.g. 'sudo apt install -y nodejs npm' or use nvm)."
command -v npm  >/dev/null 2>&1 || fail "npm not found."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node 18+ required (found $(node -v))."

say "Node $(node -v), npm $(npm -v)"

if [ ! -f .env ]; then
  say "Creating .env with safe defaults — edit before exposing publicly."
  cat > .env <<'EOF'
PORT=3002
JWT_SECRET=local_dev_secret_change_me
CORS_ORIGIN=http://localhost:3002
DB_PATH=./src/db/database.sqlite
SEED_TEST_USERS=0
SEED_ADMIN_PASSWORD=ragabag123
EOF
fi

say "Installing npm dependencies (this can take a minute)…"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

say "Initializing SQLite schema (idempotent)…"
node -e "require('./src/db/initDb').initDb(); console.log('db ready');"

say "Done. Start with:  node server.js   (or:  npm start  if defined)"
say "API will listen on PORT from .env (default 3002)."
