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
  ssh $SSH_OPTS "$SSH_TARGET" "mkdir -p '$remote_dir'"
  tar -C "$ROOT_DIR" "${excludes[@]}" -czf - "${includes[@]}" \
    | ssh $SSH_OPTS "$SSH_TARGET" "tar -C '$remote_dir' -xzf -"
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
