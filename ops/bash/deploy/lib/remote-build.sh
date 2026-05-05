#!/usr/bin/env bash
# Remote build + PM2 restart driven by an inline heredoc.

run_remote_build_and_start() {
  local remote_dir="$1"
  echo "-- Running Remote Build & Start --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
# Force PATH update for non-interactive shells
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin

cd "$remote_dir"

echo "-- Installing Backend dependencies (npm ci, lockfile-pinned) --"
( cd Codebase/Backend && (npm ci --include=dev || npm install --include=dev) && npm run build )

echo "-- Installing Frontend dependencies (npm ci, lockfile-pinned) --"
( cd Codebase/Frontend && (npm ci || npm install) && npm run build )

echo "-- Compiling Microservice (-j1, low-RAM Lightsail safe) --"
mkdir -p Codebase/Microservice/build
# 1GB Lightsail instances OOM-kill cc1plus even on serial builds when a
# single template-heavy translation unit needs >2GB. Combine:
#   - serial make
#   - -O0 (kills heavy optimizer memory)
#   - --param ggc-min-heapsize=131072 (smaller GC heap)
#   - 4G swapfile (set up by lightsail-launch.sh)
( cd Codebase/Microservice/build \
  && cmake -DCMAKE_BUILD_TYPE=Debug \
           -DCMAKE_CXX_FLAGS="-O0 -g0 --param ggc-min-heapsize=131072 --param ggc-min-expand=10" \
           .. \
  && make -j1 )

echo "-- Freeing Ports 80/443 & Starting PM2 --"
sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  [ -n "\$PID" ] && sudo kill -9 \$PID && sleep 1
done

cd Codebase/Backend
# Ensure PM2 is installed globally on the host
sudo npm install -g pm2 2>/dev/null || true
sudo pm2 delete neoterritory 2>/dev/null || true
sudo PORT=80 SSL_PORT=443 HOST=0.0.0.0 NODE_ENV=production pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save
EOF
}
