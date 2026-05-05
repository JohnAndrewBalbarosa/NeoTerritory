#!/usr/bin/env bash
# Remote build + PM2 restart driven by an inline heredoc.
#
# Speed strategy (1GB Lightsail — memory-constrained, so no parallel node builds):
#   - npm ci only when package-lock.json hash changes (cached at .deploy-cache/<name>.lock.sha)
#   - C++ build is incremental: keep build/ across deploys, re-run cmake only when
#     CMakeCache.txt is missing; otherwise plain `make` picks up changed TUs
#   - Permission reclaim only touches files actually owned by root

run_remote_build_and_start() {
  local remote_dir="$1"
  echo "-- Running Remote Build & Start --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin

cd "$remote_dir"
mkdir -p .deploy-cache

# Reclaim ownership only if anything is currently root-owned (cheap no-op otherwise).
reclaim() {
  local dir="\$1"
  if sudo find "\$dir" -maxdepth 3 -user root -print -quit 2>/dev/null | grep -q .; then
    sudo chown -R \$USER:\$USER "\$dir"
  fi
}

# Hash-gated npm ci: only reinstall if package-lock.json changed.
npm_install_if_changed() {
  local pkg_dir="\$1" cache_key="\$2"
  local lock="\$pkg_dir/package-lock.json"
  local cache=".deploy-cache/\$cache_key.lock.sha"
  local current
  if [ ! -f "\$lock" ]; then
    ( cd "\$pkg_dir" && npm install --include=dev )
    return
  fi
  current=\$(sha256sum "\$lock" | awk '{print \$1}')
  if [ -f "\$cache" ] && [ "\$(cat "\$cache")" = "\$current" ] && [ -d "\$pkg_dir/node_modules" ]; then
    echo "   [skip] \$cache_key deps unchanged"
  else
    ( cd "\$pkg_dir" && (npm ci --include=dev || npm install --include=dev) )
    echo "\$current" > "\$cache"
  fi
}

build_backend() {
  echo "-- Backend: install + build --"
  reclaim Codebase/Backend
  npm_install_if_changed Codebase/Backend backend
  ( cd Codebase/Backend && npm run build )
}

build_frontend() {
  echo "-- Frontend: install + build --"
  reclaim Codebase/Frontend
  npm_install_if_changed Codebase/Frontend frontend
  ( cd Codebase/Frontend && npm run build )
}

# Sequential on purpose: 1GB Lightsail OOMs if vite + tsc + two npm ci run together.
build_backend
build_frontend

echo "-- Microservice: incremental compile (-j1, low-RAM Lightsail safe) --"
# Keep build/ across deploys so make can do incremental compilation.
# Only re-run cmake when CMakeCache.txt is missing (first build or manual wipe).
mkdir -p Codebase/Microservice/build
if [ ! -f Codebase/Microservice/build/CMakeCache.txt ]; then
  ( cd Codebase/Microservice/build \
    && cmake -DCMAKE_BUILD_TYPE=Debug \
             -DCMAKE_CXX_FLAGS="-O0 -g0 --param ggc-min-heapsize=131072 --param ggc-min-expand=10" \
             .. )
fi
( cd Codebase/Microservice/build && make -j1 )

echo "-- Freeing Ports 80/443 & Starting PM2 --"
sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  [ -n "\$PID" ] && sudo kill -9 \$PID && sleep 1
done

cd Codebase/Backend
sudo npm install -g pm2 2>/dev/null || true
sudo pm2 delete neoterritory 2>/dev/null || true
sudo PORT=80 SSL_PORT=443 HOST=0.0.0.0 NODE_ENV=production pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save
EOF
}
