# Session Orchestration Assets

This folder is intentionally decoupled from the C++ source tree and contains only container/orchestration assets for per-user runtime sessions.

## Structure

- `docker/Dockerfile`
- `k8s/templates/user-session-pod.yaml`
- `k8s/templates/user-routing.yaml`

## Template Variables

- `{{user_id}}`: unique user/session id managed by your Manager API.
- `{{image}}`: container image reference built from `docker/Dockerfile`.

## Notes

- `user-session-pod.yaml` is a single-Pod template with:
  - `activeDeadlineSeconds: 3600`
  - `resources.requests`: `cpu: "1"`, `memory: "2Gi"`
  - `resources.limits`: `cpu: "2"`, `memory: "4Gi"`
- `user-routing.yaml` provides:
  - one dedicated ClusterIP Service per `user_id`
  - one dedicated Ingress path: `/session/{{user_id}}`
- No Deployment or ReplicaSet resources are included.
