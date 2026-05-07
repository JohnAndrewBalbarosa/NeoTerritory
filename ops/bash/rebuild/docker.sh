#!/usr/bin/env bash
# ops/bash/rebuild/docker.sh — rebuild the neoterritory Docker image and
# restart the runtime container on :3001. Includes /api/health verification.
#
# Standalone:  ./ops/bash/rebuild/docker.sh
# Orchestrated: called by scripts/rebuild.sh and start.sh --rebuild=...
#
# Reads optional NEOTERRITORY_NO_RESTART=1 to build the image without
# restarting the container (useful when chained with other rebuilds).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

IMAGE_TAG="${NEOTERRITORY_IMAGE_TAG:-neoterritory:latest}"
CONTAINER_NAME="${NEOTERRITORY_CONTAINER_NAME:-neoterritory}"
DOCKERFILE="Codebase/Infrastructure/session-orchestration/docker/Dockerfile"
PORT="${NEOTERRITORY_PORT:-3001}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[rebuild:docker] ERROR: docker CLI not on PATH" >&2
  exit 1
fi

hash_image() {
  docker image inspect "$1" --format '{{.Id}}' 2>/dev/null \
    | sed 's/sha256://; s/\(............\).*/\1/' || echo absent
}

echo "[rebuild:docker] image     : $IMAGE_TAG"
echo "[rebuild:docker] before id : $(hash_image "$IMAGE_TAG")"

docker build -t "$IMAGE_TAG" -f "$DOCKERFILE" . 2>&1 | tail -12

AFTER_IMG="$(hash_image "$IMAGE_TAG")"
echo "[rebuild:docker] after  id : $AFTER_IMG"
if [[ "$AFTER_IMG" == "absent" ]]; then
  echo "[rebuild:docker] ERROR: image not produced" >&2
  exit 1
fi

if [[ "${NEOTERRITORY_NO_RESTART:-0}" == "1" ]]; then
  echo "[rebuild:docker] NEOTERRITORY_NO_RESTART=1 — skipping container restart"
  exit 0
fi

echo "[rebuild:docker] restarting container $CONTAINER_NAME on :$PORT"
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
STALE="$(lsof -ti :"$PORT" 2>/dev/null || true)"
if [[ -n "$STALE" ]]; then
  echo "[rebuild:docker] killing stale process on :$PORT (pid=$STALE)"
  kill -9 $STALE 2>/dev/null || true
  sleep 1
fi

docker run -d --name "$CONTAINER_NAME" \
  -p "$PORT":3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$IMAGE_TAG" >/dev/null

sleep 4
docker ps --filter name="$CONTAINER_NAME" --format "  {{.Names}}  {{.Status}}  {{.Ports}}"

echo "[rebuild:docker] checking /api/health"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/health" || echo 000)"
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "[rebuild:docker] /api/health → 200 OK"
else
  echo "[rebuild:docker] /api/health → $HTTP_CODE (NOT OK)" >&2
  echo "[rebuild:docker] recent container logs:" >&2
  docker logs --tail 20 "$CONTAINER_NAME" || true
  exit 1
fi
