# Docker pod isolation — current status and migration plan

**Owner:** Drew
**Status:** Production-default ON. The runtime image bakes `ENABLE_TEST_RUNNER=1`, `TEST_RUNNER_USE_DOCKER=1`, and a firejail `TEST_RUNNER_SANDBOX`. `scripts/rebuild.sh` and the deploy launchers bind-mount `/var/run/docker.sock` so the in-container CLI can spawn sibling pods. If pods can't reach the host daemon (e.g. socket missing, daemon down), the runner falls back to the local firejail sandbox automatically.
**Intent:** Once the testing phase ends, move the Docker pod surface off the dev workstation onto a dedicated machine and re-enable per-tester containers.

---

## Why this isn't on Drew's Windows box right now

Verified attempts:

1. `wsl -l -v` from PowerShell + Bash both returned `The system cannot find the path specified.` — no WSL distro is registered on this host. Can't reach a Linux side from this session.
2. Docker Desktop is not currently running on the Windows host either, so `docker info` fails the daemon probe (`scripts/verify-requirements.ps1` reports `daemon_down`).
3. The status card previously read "disabled (env)" because `TEST_RUNNER_USE_DOCKER` was unset. As of the production-default flip, it is now baked to `1` in the image; if the host daemon isn't reachable the row will read "disabled (start Docker Desktop)" or "disabled (docker not on PATH)" instead — and the runner falls back to the local firejail sandbox.

Net effect: the runner uses the local sandbox path inside `testRunnerService.runPhase`. Microservice (annotated source) is unaffected because it never touched Docker — it spawns the local C++ build executable directly.

---

## What's already wired (no work needed at migration time, just config)

- `Codebase/Backend/src/services/podManager.ts` — full pod lifecycle: `ensurePod`, `getPod`, `disposePod`, `disposeAll`, `execInPod`, `copyIntoPod`, sweep timer, SIGINT/SIGTERM/beforeExit hooks, image build, daemon probe, diagnostic enum.
- `Codebase/Backend/server.ts` — `registerShutdownHooks()` + `startSweepTimer()` on boot; `ensurePodImageBuilt()` fires async.
- `Codebase/Backend/src/controllers/authController.ts` — `claimSeat` fires `setImmediate(() => ensurePod(...))` after `res.json`. Non-blocking.
- `Codebase/Backend/src/services/testRunnerService.ts` — `runPhase` uses `getPod()` synchronously; falls through to local sandbox immediately if no pod is up; warm-up is fire-and-forget.
- `Codebase/Backend/src/routes/analysis.ts` — `/api/health` returns `docker: { enabled, imageReady, livePods, reason }`.
- `Codebase/Frontend/src/hooks/useHealth.ts` + `MainLayout.tsx` — Status card "Docker service:" row with specific reason labels.
- `Codebase/Backend/docker/cpp-pod.Dockerfile` — Alpine + g++, drops to `nobody`, `/work` tmpfs, network=none, 128 MB / 0.25 CPU caps.
- `start.ps1` / `start.sh` / `scripts/verify-requirements.{ps1,sh}` — verifier checks `docker` + `docker info`, prints actionable messages.

The whole chain is feature-flagged on `TEST_RUNNER_USE_DOCKER`. Flip the flag and everything turns on; flip it off and every Docker call is skipped.

---

## Migration plan — moving Docker to a dedicated machine

Three deployment shapes, easiest to most isolated. Pick one when the testing phase ends.

### Option A — Same backend host, real Docker engine

Simplest. Install Docker Engine on a dedicated Linux box (or a beefier Windows host with Docker Desktop), run the existing backend on the same machine.

Steps:
1. Provision a Linux VM with Docker Engine.
2. Clone the repo, run `./start.sh` once to pre-build `cpp-pod`.
3. Set `TEST_RUNNER_USE_DOCKER=1` in `Codebase/Backend/.env`.
4. Restart the backend.

No code changes. Status card flips to "online".

### Option B — Backend on workstation, Docker on a remote daemon

Keep the backend running where Drew develops, point it at a remote Docker daemon over TCP/TLS or an SSH tunnel.

Backend env additions:
```
DOCKER_HOST=ssh://docker@pods.internal
# or DOCKER_HOST=tcp://pods.internal:2376 with DOCKER_TLS_VERIFY=1 + DOCKER_CERT_PATH
```

Code change needed: tiny — `podManager.ts` already shells out to the `docker` CLI which honours `DOCKER_HOST` automatically. Verify by `docker --host=$DOCKER_HOST info` on the workstation.

Considerations:
- Image build runs on the remote daemon (build context streamed over the wire); the Dockerfile path stays local but `docker build` ships its context.
- File copies (`docker cp host:path container:/work`) work transparently; backend writes the runDir to its local fs, then `docker cp` from the *daemon's* perspective. **This needs verification** — `docker cp src dest` reads `src` from the *client's* cwd in newer Docker but from the *daemon's* fs on older builds. If broken, swap `copyIntoPod()` to `docker exec ... sh -c "cat > /work/file"` with stdin streaming.

### Option C — Pod orchestrator (k8s / Nomad)

For multi-host scale. Out of scope for the testing phase but the existing skill stack (`pod` terminology, per-user namespaces, TTL) maps cleanly onto k8s pods. Reuse the cpp-pod Dockerfile as the pod template; replace `podManager` with a Kubernetes API client; everything else unchanged.

Trigger this when concurrent tester count exceeds what one Docker host can serve (estimated ~30 simultaneous pods at current resource caps).

---

## Pre-migration checklist

Before flipping the env flag on the migration host:

- [ ] `scripts/verify-requirements.sh pods` returns all green.
- [ ] `docker build -f Codebase/Backend/docker/cpp-pod.Dockerfile -t neoterritory/cpp-pod:latest Codebase/Backend/docker` succeeds on the target.
- [ ] `docker run --rm -m 128m --cpus 0.25 --network none neoterritory/cpp-pod:latest g++ --version` prints g++.
- [ ] Backend `.env` on the target has `TEST_RUNNER_USE_DOCKER=1` AND `JWT_SECRET` set (production must not rely on the one-shot dev secret).
- [ ] `/api/health`'s `docker.enabled` returns true and `docker.imageReady` returns true.
- [ ] Sign in as a Devcon tester, check `docker.livePods` ticks to 1 within ~5s.
- [ ] Run unit tests on a sample submission, confirm the GDB phase output reads from the pod (look for the pod's container name in `docker ps` while the test runs).

## Rollback

`TEST_RUNNER_USE_DOCKER=0` in `.env` + restart. The runner reverts to the local sandbox immediately; live pods are reaped by the sweep timer within 30s, then disposed when the backend exits.

---

## Open follow-ups (deferred to migration time)

- Verify `docker cp` semantics under `DOCKER_HOST` (Option B). If broken, switch to stdin-stream copy.
- Add `POD_HOST` env so multiple backends can share one Docker host without container-name collisions (currently `nt-pod-<userId>-<rand>` already collision-resistant, but document the assumption).
- Surface live pod list in the admin Logs tab (currently only the count is shown in the studio status card).
- Per-pod resource caps may need bumping if the tester profile grows beyond 5 small files (revisit `POD_MEMORY` / `POD_CPUS`).
