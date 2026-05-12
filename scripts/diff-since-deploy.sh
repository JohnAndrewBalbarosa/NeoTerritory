#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# diff-since-deploy.sh
#
# "What changed since the live deploy, and which rebuild target do I actually
# need?" — instead of always running ./scripts/rebuild.sh (full micro+docker)
# or always running a full deploy, this script:
#
#   1. Figures out which SHA is currently running on AWS (via ~/.deploy-sha
#      written by ops/bash/deploy/lib/remote-build.sh at end of last deploy).
#   2. Diffs local HEAD against that SHA: `git diff --name-only <sha> HEAD`.
#   3. Buckets the changed paths into four layers:
#        - microservice  : Codebase/Microservice/**
#        - backend       : Codebase/Backend/**
#        - frontend      : Codebase/Frontend/**
#        - docker        : Codebase/Infrastructure/**, Dockerfile*, package.json
#   4. Prints a per-layer diff summary.
#   5. With --run, invokes the matching ops/bash/rebuild/<layer>.sh scripts.
#      With --deploy, hands the whole thing off to scripts/deploy-aws.sh so
#      the changes hit prod.
#
# Usage:
#   ./scripts/diff-since-deploy.sh                # report only
#   ./scripts/diff-since-deploy.sh --run          # rebuild affected layers locally
#   ./scripts/diff-since-deploy.sh --deploy       # full AWS deploy
#   ./scripts/diff-since-deploy.sh --target=aws   # read SHA from AWS box (default)
#   ./scripts/diff-since-deploy.sh --target=local # read SHA from .deploy-sha.local
#   ./scripts/diff-since-deploy.sh --sha=<sha>    # diff against an explicit SHA
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.env.deploy"

MODE_RUN=0
MODE_DEPLOY=0
TARGET="aws"
EXPLICIT_SHA=""
for arg in "$@"; do
  case "$arg" in
    --run) MODE_RUN=1 ;;
    --deploy) MODE_DEPLOY=1 ;;
    --target=aws) TARGET="aws" ;;
    --target=local) TARGET="local" ;;
    --sha=*) EXPLICIT_SHA="${arg#--sha=}" ;;
    -h|--help)
      sed -n '2,32p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

cd "$ROOT_DIR"

# ---------- 1. Resolve the deployed SHA ----------
REMOTE_SHA=""
if [ -n "$EXPLICIT_SHA" ]; then
  REMOTE_SHA="$EXPLICIT_SHA"
  echo "[sha] using explicit --sha=$REMOTE_SHA"
elif [ "$TARGET" = "local" ]; then
  if [ -f "$ROOT_DIR/.deploy-sha.local" ]; then
    REMOTE_SHA="$(cat "$ROOT_DIR/.deploy-sha.local")"
    echo "[sha] local .deploy-sha.local → $REMOTE_SHA"
  else
    echo "[sha] no .deploy-sha.local; nothing to diff against" >&2
    exit 1
  fi
else
  if [ ! -f "$ENV_FILE" ]; then
    echo "[sha] missing $ENV_FILE; cannot SSH to AWS to read .deploy-sha" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/$AWS_USER/neoterritory}"
  SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -i ${AWS_SSH_KEY}"
  REMOTE_SHA="$(ssh $SSH_OPTS "$AWS_USER@$AWS_HOST" "cat $REMOTE_APP_DIR/.deploy-sha 2>/dev/null || echo missing")"
  echo "[sha] AWS $AWS_HOST → $REMOTE_SHA"
fi

if [ "$REMOTE_SHA" = "missing" ] || [ "$REMOTE_SHA" = "unknown" ] || [ -z "$REMOTE_SHA" ]; then
  echo "[sha] no usable deploy SHA — falling back to origin/main~1 so first-time diff still works"
  REMOTE_SHA="$(git rev-parse origin/main~1 2>/dev/null || git rev-parse HEAD~1)"
fi

LOCAL_SHA="$(git rev-parse HEAD)"
if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  echo "[diff] local HEAD == deployed SHA. Nothing to rebuild."
  exit 0
fi

if ! git cat-file -e "$REMOTE_SHA" 2>/dev/null; then
  echo "[diff] deployed SHA $REMOTE_SHA is not in local git history — try 'git fetch --all'" >&2
  exit 1
fi

# ---------- 2. Diff and bucket ----------
mapfile -t CHANGED < <(git diff --name-only "$REMOTE_SHA" "$LOCAL_SHA")
if [ ${#CHANGED[@]} -eq 0 ]; then
  echo "[diff] zero files changed between $REMOTE_SHA and HEAD."
  exit 0
fi

declare -A BUCKETS=( [microservice]="" [backend]="" [frontend]="" [docker]="" [other]="" )
match_bucket() {
  local f="$1"
  case "$f" in
    Codebase/Microservice/*)            echo microservice ;;
    Codebase/Backend/*)                 echo backend ;;
    Codebase/Frontend/*)                echo frontend ;;
    Codebase/Infrastructure/*)          echo docker ;;
    Dockerfile|*/Dockerfile|*Dockerfile*) echo docker ;;
    package.json|package-lock.json)     echo docker ;;
    *)                                   echo other ;;
  esac
}

for f in "${CHANGED[@]}"; do
  b="$(match_bucket "$f")"
  BUCKETS[$b]+="$f"$'\n'
done

# ---------- 3. Report ----------
echo
echo "=== diff $REMOTE_SHA..HEAD (${#CHANGED[@]} files) ==="
TARGETS=()
for layer in microservice backend frontend docker other; do
  body="${BUCKETS[$layer]}"
  if [ -z "$body" ]; then
    printf '  [%-12s] (no changes)\n' "$layer"
    continue
  fi
  count="$(printf '%s' "$body" | grep -c .)"
  printf '  [%-12s] %d file(s):\n' "$layer" "$count"
  printf '%s' "$body" | sed 's/^/      /'
  if [ "$layer" != "other" ]; then
    TARGETS+=("$layer")
  fi
done
echo
echo "Affected rebuild targets: ${TARGETS[*]:-none}"

# ---------- 4. Act ----------
if [ "$MODE_DEPLOY" = "1" ]; then
  if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "[deploy] no code layers changed; skipping AWS deploy."
    exit 0
  fi
  echo "[deploy] running full deploy-aws.sh --source --yes (the deploy script rebuilds whatever rsync delivered)"
  exec "$ROOT_DIR/scripts/deploy-aws.sh" --source --yes
fi

if [ "$MODE_RUN" = "1" ]; then
  if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "[run] no code layers changed; nothing to do."
    exit 0
  fi
  for t in "${TARGETS[@]}"; do
    script="$ROOT_DIR/ops/bash/rebuild/${t}.sh"
    if [ ! -x "$script" ]; then
      echo "[run] WARN: $script missing or not executable; skipping" >&2
      continue
    fi
    echo
    echo "============================================================"
    echo ">> ./ops/bash/rebuild/${t}.sh"
    echo "============================================================"
    "$script"
  done
  # Record what we just rebuilt locally so the next diff is honest.
  echo "$LOCAL_SHA" > "$ROOT_DIR/.deploy-sha.local"
  echo "[done] wrote $LOCAL_SHA → .deploy-sha.local"
  exit 0
fi

echo
echo "(report-only; pass --run to rebuild locally, or --deploy to push to AWS)"
