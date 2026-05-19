#!/usr/bin/env bash
# One-shot: SCP the seed v2 script to the AWS server and run it against
# the production SQLite at dist/src/db/database.sqlite.
#
# Reads SSH credentials from scripts/.env.deploy (same envelope used by
# wipe-and-resoak.sh). Destructive — wipes existing participant runs,
# decisions, logs, and audit_log entries inside the May 15-17 window
# and replaces them with the 150-session v2 dataset.
#
# Usage:
#   bash tools/thesis-sim/reseed-aws.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/.env.deploy"
SSH_KEY="${AWS_SSH_KEY/#\~/$HOME}"
SSH_KEY="${SSH_KEY//\$HOME/$HOME}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i $SSH_KEY"
SSH_TARGET="$AWS_USER@$AWS_HOST"

REMOTE_REPO="${REMOTE_APP_DIR:-/home/ubuntu/neoterritory}"
REMOTE_DB="$REMOTE_REPO/Codebase/Backend/dist/src/db/database.sqlite"
REMOTE_SEED="$REMOTE_REPO/tools/thesis-sim/seed-50-participants.mjs"

echo "== uploading seed v2 to $SSH_TARGET:$REMOTE_SEED =="
scp $SSH_OPTS "$ROOT/tools/thesis-sim/seed-50-participants.mjs" "$SSH_TARGET:$REMOTE_SEED"

echo "== row counts BEFORE reseed =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 $REMOTE_DB \
  \"SELECT 'analysis_runs', COUNT(*) FROM analysis_runs UNION ALL \
   SELECT 'manual_pattern_decisions', COUNT(*) FROM manual_pattern_decisions UNION ALL \
   SELECT 'logs', COUNT(*) FROM logs UNION ALL \
   SELECT 'audit_log', COUNT(*) FROM audit_log UNION ALL \
   SELECT 'run_feedback', COUNT(*) FROM run_feedback;\""

echo "== running seed v2 against $REMOTE_DB =="
ssh $SSH_OPTS "$SSH_TARGET" "cd $REMOTE_REPO && SEED_DB_PATH=$REMOTE_DB node tools/thesis-sim/seed-50-participants.mjs"

echo "== row counts AFTER reseed =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 $REMOTE_DB \
  \"SELECT 'analysis_runs', COUNT(*) FROM analysis_runs UNION ALL \
   SELECT 'manual_pattern_decisions', COUNT(*) FROM manual_pattern_decisions UNION ALL \
   SELECT 'logs', COUNT(*) FROM logs UNION ALL \
   SELECT 'audit_log', COUNT(*) FROM audit_log UNION ALL \
   SELECT 'run_feedback', COUNT(*) FROM run_feedback;\""

echo "Done. jbalbarosa15@gmail.com should now see the v2 dataset (refresh /admin)."
