#!/usr/bin/env bash
# One-shot: SSH to AWS, wipe test data, then trigger local 50-tester soak.
# Run from repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/.env.deploy"
SSH_KEY="${AWS_SSH_KEY/#\~/$HOME}"
SSH_KEY="${SSH_KEY//\$HOME/$HOME}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -i $SSH_KEY"
SSH_TARGET="$AWS_USER@$AWS_HOST"

echo "== row counts BEFORE wipe =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 /home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite \
  \"SELECT 'run_feedback', COUNT(*) FROM run_feedback UNION ALL \
   SELECT 'session_feedback', COUNT(*) FROM session_feedback UNION ALL \
   SELECT 'manual_pattern_decisions', COUNT(*) FROM manual_pattern_decisions UNION ALL \
   SELECT 'analysis_runs', COUNT(*) FROM analysis_runs UNION ALL \
   SELECT 'logs', COUNT(*) FROM logs;\""

echo "== wiping =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 /home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite <<'SQL'
BEGIN;
DELETE FROM run_feedback;
DELETE FROM session_feedback;
DELETE FROM manual_pattern_decisions;
DELETE FROM analysis_runs;
DELETE FROM survey_pretest;
DELETE FROM survey_consent;
DELETE FROM logs WHERE event_type LIKE 'gdb.%' OR event_type IN ('analysis_started','analysis_completed','survey_submitted','manual_review_recorded');
DELETE FROM jobs;
UPDATE users SET claimed_at = NULL, last_active = NULL WHERE username LIKE 'devcon%';
COMMIT;
SQL"

echo "== row counts AFTER wipe =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 /home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite \
  \"SELECT 'run_feedback', COUNT(*) FROM run_feedback UNION ALL \
   SELECT 'session_feedback', COUNT(*) FROM session_feedback UNION ALL \
   SELECT 'manual_pattern_decisions', COUNT(*) FROM manual_pattern_decisions UNION ALL \
   SELECT 'analysis_runs', COUNT(*) FROM analysis_runs UNION ALL \
   SELECT 'logs', COUNT(*) FROM logs;\""

echo "== seats free =="
ssh $SSH_OPTS "$SSH_TARGET" "sqlite3 /home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite \
  \"SELECT username, claimed_at FROM users WHERE username LIKE 'devcon%' AND claimed_at IS NOT NULL;\"" || true

echo "Done."
