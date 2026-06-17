#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# rollback.sh - Dist-snapshot rollback for the single 2GB AWS box.
#
# Why a snapshot and not Capistrano release dirs?
#   The deploy ships + builds in-place inside $REMOTE_APP_DIR. Two things live
#   in-place there and MUST survive a deploy:
#     - runtime data: Codebase/Backend/{database.sqlite,uploads,outputs,test}
#     - build caches:  node_modules, Codebase/Microservice/build, .deploy-cache
#   Fresh release dirs would orphan the SQLite DB (data loss) and force a full
#   from-scratch npm ci + cmake + vite every deploy (OOM-risky on 2GB).
#
#   Instead we snapshot only the BUILT ARTIFACTS — which are what the running
#   app actually serves — before each build overwrites them:
#       Codebase/Backend/dist        (compiled server JS)
#       Codebase/Frontend/dist       (the SPA bundle the backend serves)
#       Codebase/Microservice/build/NeoTerritory  (the analysis binary)
#       .deploy-sha                  (which commit these came from)
#   Total ~tens of MB. `--rollback` restores them over the current tree and
#   bounces pm2. node_modules / SQLite / uploads / caches are never touched.
#
# Limitation (inherent to any code rollback): this does NOT revert database
# migrations. If a deploy changed the SQLite schema, rolling back the code can
# leave the DB ahead of it. Snapshot the DB separately before risky migrations.
# -----------------------------------------------------------------------------

BACKEND_DIST_EXCLUDES=(--exclude='Codebase/Backend/dist/src/db/.ai-config-key')

# Capture the currently-running built artifacts into .rollback/previous BEFORE
# the new build clobbers them. Called from deploy-aws.sh right before the build.
# Best-effort: a first-ever deploy (no current dist) simply skips.
snapshot_current_artifacts() {
  local remote_dir="$1"
  echo "-- Snapshotting current built artifacts for rollback --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
cd "$remote_dir" 2>/dev/null || { echo "   [snapshot] app dir missing — first deploy, skipping"; exit 0; }

SNAP=".rollback/previous"

# Only snapshot a KNOWN-GOOD state: the backend server bundle must exist.
# (On the first deploy onto a clean box there is nothing good to keep yet.)
if [ ! -f Codebase/Backend/dist/server.js ]; then
  echo "   [snapshot] no current Backend/dist/server.js — nothing to snapshot (first deploy?). Skipping."
  exit 0
fi

rm -rf "\$SNAP"
mkdir -p "\$SNAP/Codebase/Backend" "\$SNAP/Codebase/Frontend" "\$SNAP/Codebase/Microservice/build"

tar "${BACKEND_DIST_EXCLUDES[@]}" -C "$remote_dir" -cpf - Codebase/Backend/dist \
  | tar -C "\$SNAP/Codebase/Backend" -xpf -
if [ -d Codebase/Frontend/dist ]; then
  cp -a Codebase/Frontend/dist "\$SNAP/Codebase/Frontend/dist"
fi
if [ -f Codebase/Microservice/build/NeoTerritory ]; then
  cp -a Codebase/Microservice/build/NeoTerritory "\$SNAP/Codebase/Microservice/build/NeoTerritory"
fi
[ -f .deploy-sha ] && cp -a .deploy-sha "\$SNAP/.deploy-sha" || true

echo "   [snapshot] saved previous artifacts (sha=\$(cat .deploy-sha 2>/dev/null || echo unknown)) to \$SNAP"
du -sh "\$SNAP" 2>/dev/null | awk '{print "   [snapshot] size: "\$1}'
EOF
}

# Restore the .rollback/previous artifacts over the current tree and bounce pm2.
# Mirrors the restart-only smoke so we only declare success after a real 200.
run_remote_rollback() {
  local remote_dir="$1"
  echo "-- Rolling back to previous artifact snapshot --"
  ssh $SSH_OPTS "$SSH_TARGET" "bash -l -s" <<EOF
set -e
export PATH=\$PATH:/usr/bin:/usr/local/bin:/snap/bin
cd "$remote_dir"

SNAP=".rollback/previous"
if [ ! -f "\$SNAP/Codebase/Backend/dist/server.js" ]; then
  echo "FATAL: no rollback snapshot at \$SNAP (need Codebase/Backend/dist/server.js)."
  echo "A snapshot is created at the START of each deploy — none exists yet, so there is"
  echo "nothing to roll back to. Deploy once (which snapshots the running build), then a"
  echo "later --rollback can return to it."
  exit 1
fi

ROLLBACK_SHA=\$(cat "\$SNAP/.deploy-sha" 2>/dev/null || echo unknown)
echo "   [rollback] restoring artifacts from snapshot (sha=\$ROLLBACK_SHA)"

# Backend server bundle
rm -rf Codebase/Backend/dist
tar --exclude='dist/src/db/.ai-config-key' -C "\$SNAP/Codebase/Backend" -cpf - dist \
  | tar -C Codebase/Backend -xpf -

# Frontend SPA bundle
if [ -d "\$SNAP/Codebase/Frontend/dist" ]; then
  rm -rf Codebase/Frontend/dist
  cp -a "\$SNAP/Codebase/Frontend/dist" Codebase/Frontend/dist
fi

# Microservice binary
if [ -f "\$SNAP/Codebase/Microservice/build/NeoTerritory" ]; then
  mkdir -p Codebase/Microservice/build
  cp -a "\$SNAP/Codebase/Microservice/build/NeoTerritory" Codebase/Microservice/build/NeoTerritory
fi

[ -f "\$SNAP/.deploy-sha" ] && cp -a "\$SNAP/.deploy-sha" .deploy-sha || true

# ---- bounce pm2 against restored artifacts (same shape as restart-only) ----
cd Codebase/Backend
if [ ! -f dist/server.js ]; then
  echo "FATAL: restored dist/server.js missing — snapshot was corrupt."
  exit 1
fi

sudo systemctl stop nginx apache2 2>/dev/null || true
for p in 80 443; do
  PID=\$(sudo fuser \$p/tcp 2>/dev/null | awk '{print \$NF}' || true)
  if [ -n "\$PID" ]; then
    echo "   [port] freeing :\$p (pid=\$PID)"
    sudo kill -9 \$PID && sleep 1
  fi
done

sudo pm2 delete neoterritory 2>/dev/null || true
echo "   [pm2] starting rolled-back build on :80/:443"
sudo PORT=80 SSL_PORT=443 HOST=0.0.0.0 NODE_ENV=production pm2 start dist/server.js --name neoterritory --update-env
sudo pm2 save

# ---- smoke: only success after a real 200 from inside the box ----
for i in \$(seq 1 30); do
  CODE=\$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://127.0.0.1/health 2>/dev/null || echo 000)
  if [ "\$CODE" = "200" ]; then
    echo "   [smoke] /health -> 200 OK after attempt \$i — rollback to \$ROLLBACK_SHA is live"
    exit 0
  fi
  echo "   [smoke] attempt \$i/30: /health -> \$CODE (waiting 2s...)"
  sleep 2
done

echo "   [smoke] FAILED after rollback — pm2 status + logs:"
sudo pm2 status || true
sudo pm2 logs neoterritory --lines 80 --nostream || true
exit 1
EOF
}
