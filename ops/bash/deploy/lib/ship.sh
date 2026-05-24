#!/usr/bin/env bash
# Tar + ssh-pipe the source tree to AWS, then write Backend/.env on the remote.

# Remove repo-owned SOURCE trees on the remote before extracting the fresh
# tar, so files DELETED from the repo do not linger on the host. The plain
# `tar -xzf` overwrites changed files but never removes deletions — that is
# how a stale source file (e.g. a removed component still importing dropped
# exports) can keep breaking the on-server build long after it left git.
#
# Caches and build artifacts are NOT shipped (see manifest excludes) and must
# survive, so we prune each package's contents while protecting node_modules /
# dist / build* / .deploy-cache / .env / runtime data. The tar extract right
# after restores every shipped file, so only genuinely-deleted files stay gone.
prune_remote_stale_sources() {
  local remote_dir="$1"
  echo "-- Pruning stale source on remote (caches preserved) --"
  ssh $SSH_OPTS "$SSH_TARGET" "set -e; cd '$remote_dir' 2>/dev/null || exit 0; \
    if [ -d Codebase/Backend ]; then \
      find Codebase/Backend -mindepth 1 -maxdepth 1 \
        ! -name node_modules ! -name dist ! -name .env ! -name .deploy-cache \
        ! -name database.sqlite ! -name uploads ! -name outputs \
        -exec rm -rf {} + ; fi; \
    if [ -d Codebase/Frontend ]; then \
      find Codebase/Frontend -mindepth 1 -maxdepth 1 \
        ! -name node_modules ! -name dist ! -name .deploy-cache \
        -exec rm -rf {} + ; fi; \
    if [ -d Codebase/Microservice ]; then \
      find Codebase/Microservice -mindepth 1 -maxdepth 1 \
        ! -name 'build*' ! -name .deploy-cache \
        -exec rm -rf {} + ; fi; \
    echo '   [prune] stale source removed; node_modules/dist/build caches kept'"
}

ship_source() {
  local remote_dir="$1"
  echo "-- Shipping SOURCE to $SSH_TARGET --"

  # ── includes + excludes load from deploy.manifest.json ──────────────
  # Single source of truth at repo root. Edited like package.json — no
  # bash array editing required when adding a folder to the ship list.
  # Schema lives at scripts/deploy-manifest.schema.json.
  local manifest="$ROOT_DIR/deploy.manifest.json"
  if [ ! -f "$manifest" ]; then
    echo "   [ship] ERROR: deploy.manifest.json not found at repo root" >&2
    return 1
  fi
  local includes excludes
  mapfile -t includes < <(python3 -c "
import json, sys
with open(sys.argv[1]) as f: m = json.load(f)
for p in m.get('includes', []): print(p)
" "$manifest")
  mapfile -t excludes_raw < <(python3 -c "
import json, sys
with open(sys.argv[1]) as f: m = json.load(f)
for p in m.get('excludes', []): print(p)
" "$manifest")
  excludes=()
  for pat in "${excludes_raw[@]}"; do
    excludes+=( "--exclude=$pat" )
  done

  if [ ${#includes[@]} -eq 0 ]; then
    echo "   [ship] ERROR: deploy.manifest.json has no includes entries" >&2
    return 1
  fi

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
    # Google sign-in path. AUTH_PROVIDER defaults to "dev" when unset
    # (the existing devcon flow). Set to "supabase_cloud" on AWS so the
    # /auth/google/* handlers in googleAuth.ts read the cloud Supabase
    # project. The anon key is what the FE button + the backend
    # token-verify call use; the OAuth client values flow through to
    # GoTrue if AWS ever runs Supabase locally (no-op for cloud).
    [ -n "${AUTH_PROVIDER:-}" ]            && echo "AUTH_PROVIDER=$AUTH_PROVIDER"
    [ -n "${AUTH_SUPABASE_ANON_KEY:-}" ]   && echo "AUTH_SUPABASE_ANON_KEY=$AUTH_SUPABASE_ANON_KEY"
    [ -n "${GOOGLE_OAUTH_CLIENT_ID:-}" ]     && echo "GOOGLE_OAUTH_CLIENT_ID=$GOOGLE_OAUTH_CLIENT_ID"
    [ -n "${GOOGLE_OAUTH_CLIENT_SECRET:-}" ] && echo "GOOGLE_OAUTH_CLIENT_SECRET=$GOOGLE_OAUTH_CLIENT_SECRET"
    [ -n "${GOOGLE_OAUTH_REDIRECT_URI:-}" ]  && echo "GOOGLE_OAUTH_REDIRECT_URI=$GOOGLE_OAUTH_REDIRECT_URI"
    echo "NEOTERRITORY_BIN=$remote_dir/Codebase/Microservice/build/NeoTerritory"
    echo "NEOTERRITORY_CATALOG=$remote_dir/Codebase/Microservice/pattern_catalog"
  } > "$tmp_env"
  scp $SSH_OPTS "$tmp_env" "$SSH_TARGET:$remote_env_path" >/dev/null
  rm -f "$tmp_env"
}
