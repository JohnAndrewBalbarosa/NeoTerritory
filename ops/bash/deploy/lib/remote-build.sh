#!/usr/bin/env bash
# Remote build + PM2 restart driven by an inline heredoc.
#
# Speed strategy (1GB Lightsail — memory-constrained, so no parallel node builds):
#   - npm ci only when package-lock.json hash changes (cached at .deploy-cache/<name>.lock.sha)
#   - C++ build is incremental: keep build/ across deploys, re-run cmake only when
#     CMakeCache.txt is missing; otherwise plain `make` picks up changed TUs
#   - Permission reclaim only touches files actually owned by root
#
# Visibility strategy:
#   - phase_start/phase_end print elapsed time and a banner per phase
#   - A background heartbeat prints "[alive] phase=X elapsed=Ys mem=YMB load=Z" every 20s
#     so the operator knows the box is breathing during silent phases (npm ci, cc1plus)
#   - Show dep counts before npm install, file counts before tar/cmake, etc.

run_remote_build_and_start() {
  local remote_dir="$1"
  local sha="${DEPLOY_GIT_SHA:-unknown}"
  echo "-- Running Remote Build & Start (deploying $sha) --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin
DEPLOY_GIT_SHA="$sha"

cd "$remote_dir"
mkdir -p .deploy-cache

# ---------- progress / heartbeat plumbing ----------
PHASE="boot"
PHASE_START=\$(date +%s)
HEARTBEAT_PID=""

human_secs() {
  local s=\$1
  if [ \$s -lt 60 ]; then echo "\${s}s"; else echo "\$((s/60))m\$((s%60))s"; fi
}

heartbeat_loop() {
  while sleep 20; do
    local now=\$(date +%s)
    local el=\$((now - PHASE_START))
    local mem load
    mem=\$(free -m 2>/dev/null | awk '/Mem:/ {printf "%dMB used / %dMB", \$3, \$2}')
    load=\$(awk '{print \$1}' /proc/loadavg 2>/dev/null)
    echo "   [alive] phase=\$PHASE elapsed=\$(human_secs \$el) mem=\$mem load=\$load"
  done
}

phase_start() {
  PHASE="\$1"
  PHASE_START=\$(date +%s)
  echo ""
  echo "============================================================"
  echo ">> [\$PHASE] starting at \$(date '+%H:%M:%S')"
  echo "============================================================"
  heartbeat_loop &
  HEARTBEAT_PID=\$!
  disown \$HEARTBEAT_PID 2>/dev/null || true
}

phase_end() {
  local rc=\${1:-0}
  local now=\$(date +%s)
  local dur=\$((now - PHASE_START))
  if [ -n "\$HEARTBEAT_PID" ] && kill -0 "\$HEARTBEAT_PID" 2>/dev/null; then
    kill "\$HEARTBEAT_PID" 2>/dev/null || true
    wait "\$HEARTBEAT_PID" 2>/dev/null || true
  fi
  HEARTBEAT_PID=""
  if [ "\$rc" = "0" ]; then
    echo "<< [\$PHASE] done in \$(human_secs \$dur)"
  else
    echo "<< [\$PHASE] FAILED after \$(human_secs \$dur) (rc=\$rc)"
  fi
}

# Make sure the heartbeat dies even if the script aborts.
trap 'phase_end \$? 2>/dev/null || true' EXIT

# ---------- helpers ----------

# Reclaim ownership only if anything is currently root-owned (cheap no-op otherwise).
reclaim() {
  local dir="\$1"
  if sudo find "\$dir" -maxdepth 3 -user root -print -quit 2>/dev/null | grep -q .; then
    echo "   [perm] reclaiming root-owned files under \$dir"
    sudo chown -R \$USER:\$USER "\$dir"
  fi
}

# Show dep summary from package.json so the operator sees what is about to install.
print_dep_summary() {
  local pkg_dir="\$1"
  local pj="\$pkg_dir/package.json"
  [ -f "\$pj" ] || return 0
  local deps dev tot
  deps=\$(node -e "try{const p=require('\$pj');process.stdout.write(String(Object.keys(p.dependencies||{}).length))}catch(e){process.stdout.write('?')}" 2>/dev/null || echo '?')
  dev=\$(node  -e "try{const p=require('\$pj');process.stdout.write(String(Object.keys(p.devDependencies||{}).length))}catch(e){process.stdout.write('?')}" 2>/dev/null || echo '?')
  tot="?"
  if [ -f "\$pkg_dir/package-lock.json" ]; then
    tot=\$(node -e "try{const p=require('\$pkg_dir/package-lock.json');const pkgs=p.packages||{};process.stdout.write(String(Math.max(0,Object.keys(pkgs).length-1)))}catch(e){process.stdout.write('?')}" 2>/dev/null || echo '?')
  fi
  echo "   [deps] direct=\$deps devDirect=\$dev lockfile-resolved=\$tot"
}

# Hash-gated npm ci: only reinstall if package-lock.json changed.
npm_install_if_changed() {
  local pkg_dir="\$1" cache_key="\$2"
  local lock="\$pkg_dir/package-lock.json"
  local cache=".deploy-cache/\$cache_key.lock.sha"
  local current
  if [ ! -f "\$lock" ]; then
    echo "   [npm] no lockfile — running npm install"
    ( cd "\$pkg_dir" && npm install --include=dev --loglevel=http --no-fund --no-audit )
    return
  fi
  current=\$(sha256sum "\$lock" | awk '{print \$1}')
  if [ -f "\$cache" ] && [ "\$(cat "\$cache")" = "\$current" ] && [ -d "\$pkg_dir/node_modules" ]; then
    local installed
    installed=\$(find "\$pkg_dir/node_modules" -maxdepth 2 -name package.json 2>/dev/null | wc -l)
    echo "   [npm] SKIP — lockfile unchanged (\$installed packages already installed)"
  else
    if [ -f "\$cache" ]; then
      echo "   [npm] lockfile CHANGED — reinstalling (\$cache_key)"
    else
      echo "   [npm] first install on this host (\$cache_key)"
    fi
    ( cd "\$pkg_dir" && (npm ci --include=dev --loglevel=http --no-fund --no-audit \
        || npm install --include=dev --loglevel=http --no-fund --no-audit) )
    local installed
    installed=\$(find "\$pkg_dir/node_modules" -maxdepth 2 -name package.json 2>/dev/null | wc -l)
    echo "   [npm] installed \$installed packages under \$pkg_dir/node_modules"
    echo "\$current" > "\$cache"
  fi
}

# Cap V8 heap on the 416MB Lightsail box so tsc/vite don't OOM. Default heap
# is ~50% of physical RAM (~256MB here); the build allocates on top, easily
# exceeding RAM and triggering OOM-kill mid-build. That's exactly what
# produced the "Frontend/dist missing -> backend serves source index.html ->
# white page" outage.
LOW_RAM_NODE_OPTS="--max-old-space-size=320"

# ---------- backend ----------
phase_start "backend"
reclaim Codebase/Backend
print_dep_summary Codebase/Backend
npm_install_if_changed Codebase/Backend backend
echo "   [tsc] compiling Backend (NODE_OPTIONS=\$LOW_RAM_NODE_OPTS) ..."
( cd Codebase/Backend && NODE_OPTIONS="\$LOW_RAM_NODE_OPTS" npm run build )
if [ ! -f Codebase/Backend/dist/server.js ]; then
  echo "   [tsc] FATAL: Backend/dist/server.js missing — tsc did not produce output"
  exit 1
fi
echo "   [tsc] dist file count: \$(find Codebase/Backend/dist -type f 2>/dev/null | wc -l)"
phase_end 0

# ---------- frontend ----------
phase_start "frontend"
reclaim Codebase/Frontend
print_dep_summary Codebase/Frontend
npm_install_if_changed Codebase/Frontend frontend
echo "   [vite] building Frontend (NODE_OPTIONS=\$LOW_RAM_NODE_OPTS) ..."
( cd Codebase/Frontend && NODE_OPTIONS="\$LOW_RAM_NODE_OPTS" npm run build )
if [ ! -f Codebase/Frontend/dist/index.html ]; then
  echo "   [vite] FATAL: Frontend/dist/index.html missing — vite build produced no output (likely OOM)."
  echo "   [vite] Without this, Backend will fall back to source index.html and the site will white-page."
  exit 1
fi
# Sanity check: production index.html must reference hashed bundles in /assets/,
# not the source /src/main.tsx entry. If we see /src/, vite emitted a dev-style
# index.html which would still produce a white page in prod.
if grep -q '/src/main.tsx' Codebase/Frontend/dist/index.html; then
  echo "   [vite] FATAL: dist/index.html still references /src/main.tsx (looks like the source file). Build is broken."
  exit 1
fi
echo "   [vite] dist file count: \$(find Codebase/Frontend/dist -type f 2>/dev/null | wc -l) (\$(du -sh Codebase/Frontend/dist 2>/dev/null | awk '{print \$1}'))"
phase_end 0

# ---------- microservice ----------
phase_start "microservice"
mkdir -p Codebase/Microservice/build
SRC_COUNT=\$(find Codebase/Microservice -name '*.cpp' -o -name '*.cc' -o -name '*.h' -o -name '*.hpp' 2>/dev/null | wc -l)
echo "   [c++] source/header files: \$SRC_COUNT"
if [ ! -f Codebase/Microservice/build/CMakeCache.txt ]; then
  echo "   [cmake] no cache — running cmake configure"
  ( cd Codebase/Microservice/build \
    && cmake -DCMAKE_BUILD_TYPE=Debug \
             -DCMAKE_CXX_FLAGS="-O0 -g0 --param ggc-min-heapsize=131072 --param ggc-min-expand=10" \
             .. )
else
  echo "   [cmake] cache present — skipping configure (incremental make)"
fi
echo "   [make] running make -j1 (low-RAM Lightsail safe; expect [NN%] progress lines from make)"
( cd Codebase/Microservice/build && make -j1 )
if [ -f Codebase/Microservice/build/NeoTerritory ]; then
  echo "   [c++] binary OK ($(du -h Codebase/Microservice/build/NeoTerritory | awk '{print \$1}'))"
fi
phase_end 0

# ---------- pm2 restart ----------
phase_start "pm2-restart"
sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  if [ -n "\$PID" ]; then
    echo "   [port] freeing :\$p (pid=\$PID)"
    sudo kill -9 \$PID && sleep 1
  fi
done

cd Codebase/Backend
if [ ! -f dist/server.js ]; then
  echo "   [pm2] FATAL: dist/server.js missing — Backend build did not produce output"
  exit 1
fi
echo "   [pm2] dist/server.js size: \$(stat -c%s dist/server.js 2>/dev/null || echo ?) bytes"

sudo npm install -g pm2 2>/dev/null || true
sudo pm2 delete neoterritory 2>/dev/null || true
echo "   [pm2] starting neoterritory on :80/:443"
sudo PORT=80 SSL_PORT=443 HOST=0.0.0.0 NODE_ENV=production pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save
phase_end 0

# ---------- smoke test ----------
# A "white page on TCP-but-no-HTTP-response" outage in the past was caused by
# pm2 reporting "online" while server.js was actually wedged at startup. Probe
# /health from inside the box and only declare success after a real 200.
phase_start "smoke-test"
SMOKE_OK=0
# Each attempt waits up to 10s for /health (the box is RAM-starved, so a
# healthy first request can take 5-10s). 30 attempts × ~12s ≈ 6min budget.
for i in \$(seq 1 30); do
  CODE=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/health 2>/dev/null || echo 000)
  if [ "\$CODE" = "200" ]; then
    echo "   [smoke] /health -> 200 OK after attempt \$i"
    SMOKE_OK=1
    break
  fi
  echo "   [smoke] attempt \$i/30: /health -> \$CODE (waiting 2s...)"
  sleep 2
done
if [ "\$SMOKE_OK" != "1" ]; then
  echo "   [smoke] FAILED — server is not responding on :80. Last 80 lines of pm2 logs:"
  sudo pm2 logs neoterritory --lines 80 --nostream || true
  echo "   [smoke] pm2 status:"
  sudo pm2 status || true
  exit 1
fi
phase_end 0

# Record the SHA we just deployed so diff-since-deploy.sh can ask the box
# "what's actually running here?" and pick the right rebuild target.
echo "${DEPLOY_GIT_SHA:-unknown}" > "$remote_dir/.deploy-sha"
echo "   [deploy-sha] wrote ${DEPLOY_GIT_SHA:-unknown} → $remote_dir/.deploy-sha"

trap - EXIT
echo ""
echo "============================================================"
echo ">> deploy complete"
echo "============================================================"
EOF
}

# Restart-only mode: bounces pm2 against the existing dist/ artifacts on the
# remote box. Use this to recover quickly when a previous deploy died mid-build
# and left pm2 in a wedged state — no rebuild, no shipping, just a clean restart
# with the same smoke test as the full deploy.
run_remote_restart_only() {
  local remote_dir="$1"
  echo "-- Restart-only: bouncing pm2 on existing artifacts --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin
cd "$remote_dir/Codebase/Backend"

if [ ! -f dist/server.js ]; then
  echo "FATAL: dist/server.js missing on remote — cannot restart-only. Run a full deploy."
  exit 1
fi
echo "dist/server.js size: \$(stat -c%s dist/server.js 2>/dev/null || echo ?) bytes"

sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  if [ -n "\$PID" ]; then
    echo "freeing :\$p (pid=\$PID)"
    sudo kill -9 \$PID && sleep 1
  fi
done

sudo pm2 delete neoterritory 2>/dev/null || true
sudo PORT=80 SSL_PORT=443 HOST=0.0.0.0 NODE_ENV=production pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save

for i in $(seq 1 30); do
  CODE=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/health 2>/dev/null || echo 000)
  if [ "\$CODE" = "200" ]; then
    echo "[smoke] /health -> 200 OK after attempt \$i"
    exit 0
  fi
  echo "[smoke] attempt \$i/30: /health -> \$CODE"
  sleep 2
done
echo "[smoke] FAILED — pm2 status + logs:"
sudo pm2 status || true
sudo pm2 logs neoterritory --lines 80 --nostream || true
exit 1
EOF
}
