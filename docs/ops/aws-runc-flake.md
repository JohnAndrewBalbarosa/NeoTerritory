# AWS host runc / Docker namespace flake — runbook

## Symptom

CI fails on the `post-deploy-smoke` job with output that looks like:

```
[run-tests] phase=static_analysis verdict=pass passed=true
[run-tests] phase=compile_run verdict=compile_error passed=false
Error: compile_run regression on AWS (verdict=compile_error):
  Access error: uid 0, last mount name:net:[...] dir:/run/docker/netns/... type:nsfs
  - invalid read-only mount
  proc <pid> cannot sync with peer: unexpected EOF
  Peer <pid> unexpectedly exited with status 1
```

This is the AWS host's Docker `runc` runtime failing to set up the
container's network namespace. It is **not** a code regression — the
same commit usually passes on retry without any change.

## Why it happens

`runc` mounts the new container's net namespace under
`/run/docker/netns/<id>` using `nsfs`. After long Docker daemon uptime
(or a host kernel/runc version drift), the daemon can leak references
to stale `nsfs` mounts and the next container setup fails with
"invalid read-only mount". The fix is to make Docker re-bind the
namespace dir from scratch.

## In-CI mitigation (already shipped)

`scripts/ci-aws-post-deploy-smoke.mjs` matches the failure text against
`RUNC_FLAKE_PATTERNS` and retries the analyze + run-tests sequence up
to `COMPILE_RUN_MAX_RETRIES` times (default: 2) with
`COMPILE_RUN_RETRY_DELAY_MS` between attempts (default: 10000 ms).
Non-flake compile errors fail fast — the retry policy intentionally
does NOT mask real regressions.

Unit tests pin both sides of the matcher:
`scripts/__tests__/ci-aws-post-deploy-smoke.test.mjs`.

Run locally with:

```bash
npm run test:smoke-retry
```

## Host-side fix (when the flake becomes persistent)

If you see the same failure on three CI runs in a row, the in-CI retry
isn't going to save it — the AWS host needs a kick. SSH to
`122.248.192.49` and run:

```bash
# 1. Confirm the symptom on the host:
sudo journalctl -u docker --since "30 min ago" | grep -E 'runc|netns|nsfs' | tail -20

# 2. Restart Docker. This re-binds /run/docker/netns from scratch
#    and drops the leaked nsfs references. ~5 sec downtime.
sudo systemctl restart docker

# 3. Re-verify with a throwaway container:
docker run --rm hello-world

# 4. If the issue recurs within a day, upgrade runc + Docker:
sudo apt-get update
sudo apt-get install --only-upgrade docker.io runc containerd
sudo systemctl restart docker
```

## When to escalate

- `systemctl restart docker` did not fix it.
- The flake hits on every retry inside the CI job (rare).
- `journalctl -u docker` shows kernel taint warnings about `nsfs` or
  `cgroup` — host kernel may need a reboot.

In those cases the host needs a full `sudo reboot`. Coordinate with
the team before rebooting prod; the studio is offline for ~1 minute.
