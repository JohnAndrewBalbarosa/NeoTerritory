#!/usr/bin/env bash
# Tar + ssh-pipe the source tree to AWS, then write Backend/.env on the remote.

ship_source() {
  local remote_dir="$1"
  echo "-- Shipping SOURCE to $SSH_TARGET --"
  local includes=( Codebase/Backend Codebase/Frontend Codebase/Microservice \
                   Codebase/Infrastructure/session-orchestration/docker scripts start.sh )
  local excludes=( --exclude='**/.git' --exclude='**/node_modules' \
                   --exclude='**/dist' --exclude='**/build' --exclude='**/build-linux' \
                   --exclude='**/.env' )

  # Pre-flight summary so the operator can see what's about to ship.
  local file_count size_human
  file_count=$(cd "$ROOT_DIR" && find "${includes[@]}" \
      -path '*/.git' -prune -o -path '*/node_modules' -prune \
      -o -path '*/dist' -prune -o -path '*/build' -prune -o -path '*/build-linux' -prune \
      -o -name '.env' -prune -o -type f -print 2>/dev/null | wc -l)
  size_human=$(cd "$ROOT_DIR" && du -sh --exclude=.git --exclude=node_modules \
      --exclude=dist --exclude=build --exclude=build-linux \
      "${includes[@]}" 2>/dev/null | awk '{ sum += $1 } END { print sum"~ (per-target sum)" }')
  echo "   [ship] files=$file_count size=$size_human"
  echo "   [ship] targets: ${includes[*]}"

  ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$remote_dir'"

  # Stream tar through pv if available so we get a live byte-rate progress bar;
  # fall back to plain tar otherwise (still emits one summary at the end).
  local started_at; started_at=$(date +%s)
  if command -v pv >/dev/null 2>&1; then
    tar -C "$ROOT_DIR" "${excludes[@]}" -czf - "${includes[@]}" \
      | pv -bart -i 2 \
      | ssh $SSH_OPTS "$SSH_TARGET" "tar -C '$remote_dir' -xzf -"
  else
    # GNU tar emits one checkpoint line per ~5MB of archive — a built-in heartbeat.
    echo "   [ship] (install 'pv' locally for a richer progress bar; using tar --checkpoint)"
    tar -C "$ROOT_DIR" "${excludes[@]}" \
        --checkpoint=500 --checkpoint-action=echo='   [ship] %{}T processed (%ds)' \
        -czf - "${includes[@]}" \
      | ssh $SSH_OPTS "$SSH_TARGET" "tar -C '$remote_dir' -xzf -"
  fi
  local elapsed=$(( $(date +%s) - started_at ))
  echo "   [ship] done in ${elapsed}s"
}

write_remote_env() {
  local remote_dir="$1"
  local remote_env_path="$remote_dir/Codebase/Backend/.env"
  local tmp_env; tmp_env="$(mktemp)"
  {
    echo "PORT=80"
    echo "SSL_PORT=443"
    echo "HOST=0.0.0.0"
    echo "NODE_ENV=production"
    echo "CORS_ORIGIN=http://${AWS_HOST}"
    [ -n "${JWT_SECRET:-}" ]        && echo "JWT_SECRET=$JWT_SECRET"
    [ -n "${AI_PROVIDER:-}" ]       && echo "AI_PROVIDER=$AI_PROVIDER"
    [ -n "${GEMINI_API_KEY:-}" ]    && echo "GEMINI_API_KEY=$GEMINI_API_KEY"
    [ -n "${GEMINI_MODEL:-}" ]      && echo "GEMINI_MODEL=$GEMINI_MODEL"
    [ -n "${ANTHROPIC_API_KEY:-}" ] && echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"
    [ -n "${ANTHROPIC_MODEL:-}" ]   && echo "ANTHROPIC_MODEL=$ANTHROPIC_MODEL"
    [ -n "${ADMIN_USERNAME:-}" ]    && echo "ADMIN_USERNAME=$ADMIN_USERNAME"
    [ -n "${ADMIN_PASSWORD:-}" ]    && echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
    [ -n "${SEED_TEST_USERS:-}" ]   && echo "SEED_TEST_USERS=$SEED_TEST_USERS"
    [ -n "${TEST_RUNNER_USE_DOCKER:-}" ] && echo "TEST_RUNNER_USE_DOCKER=$TEST_RUNNER_USE_DOCKER"
    # Test runner gate. Both must be present in production (NODE_ENV=production
    # rejects an empty TEST_RUNNER_SANDBOX) — otherwise /api/runs returns 503
    # with "set ENABLE_TEST_RUNNER=1 and TEST_RUNNER_SANDBOX explicitly".
    [ -n "${ENABLE_TEST_RUNNER:-}" ]    && echo "ENABLE_TEST_RUNNER=$ENABLE_TEST_RUNNER"
    [ -n "${TEST_RUNNER_SANDBOX:-}" ]   && echo "TEST_RUNNER_SANDBOX=$TEST_RUNNER_SANDBOX"
    [ -n "${SUPABASE_URL:-}" ]      && echo "SUPABASE_URL=$SUPABASE_URL"
    [ -n "${SUPABASE_SERVICE_KEY:-}" ] && echo "SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY"
    [ -n "${SUPABASE_LOGS_TABLE:-}" ]  && echo "SUPABASE_LOGS_TABLE=$SUPABASE_LOGS_TABLE"
    [ -n "${SUPABASE_AUDIT_TABLE:-}" ] && echo "SUPABASE_AUDIT_TABLE=$SUPABASE_AUDIT_TABLE"
    echo "NEOTERRITORY_BIN=$remote_dir/Codebase/Microservice/build/NeoTerritory"
    echo "NEOTERRITORY_CATALOG=$remote_dir/Codebase/Microservice/pattern_catalog"
  } > "$tmp_env"
  scp $SSH_OPTS "$tmp_env" "$SSH_TARGET:$remote_env_path" >/dev/null
  rm -f "$tmp_env"
}
