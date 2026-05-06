// Per-tester ephemeral Docker pod manager.
//
// One small short-lived container per online tester (devconN). Spun up
// asynchronously when a seat is claimed, identified by userId, lives for
// POD_TTL_MS (default 10 min). The container's only job is to host a
// constrained sandbox where g++ compiles and the resulting binary runs —
// the local fallback in testRunnerService.ts continues to work when this
// manager is disabled (TEST_RUNNER_USE_DOCKER != '1') or Docker isn't on
// PATH.
//
// Key guarantees:
//   • Pods are bound to user.id; a returning user reuses their existing
//     pod if its TTL hasn't expired (heartbeat extends the pod's lifetime).
//   • Pods that go past their deadline are reaped by a 30s sweep timer.
//   • SIGINT / SIGTERM / `beforeExit` triggers `disposeAll()` so the
//     server never exits leaving live containers behind.
//   • Per-pod resources are tight (default: 128 MB memory, 0.25 CPU,
//     `--network=none`) — sized for ≤5 small C++ files.

import { spawnSync, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  registerPod   as masterlistRegisterPod,
  unregisterPod as masterlistUnregisterPod,
  setImageReady as masterlistSetImageReady,
} from './healthMasterlist';

export interface PodHandle {
  podId: string;
  containerName: string;
  userId: number;
  username: string;
  createdAt: number;
  expiresAt: number;
}

interface InternalPod extends PodHandle {
  // Disposed flag prevents races where a sweep tick and an explicit
  // dispose both try to docker-rm the same container.
  disposed: boolean;
}

const POD_TTL_MS         = Number(process.env.POD_TTL_MS         || 10 * 60_000);
const POD_SWEEP_MS       = Number(process.env.POD_SWEEP_MS       || 30_000);
const POD_IMAGE          = process.env.POD_IMAGE                 || 'neoterritory/cpp-pod:latest';
const POD_MEMORY         = process.env.POD_MEMORY                || '48m';
const POD_CPUS           = process.env.POD_CPUS                  || '0.25';
const POD_NETWORK        = process.env.POD_NETWORK               || 'none';
const POD_PIDS_LIMIT     = process.env.POD_PIDS_LIMIT            || '64';

const pods = new Map<number, InternalPod>();

// Diagnostic enum so the frontend can show a specific reason instead of
// a generic "disabled" — "no docker on PATH" vs "daemon not responding"
// vs env flag off each call for a different operator fix.
export type PodDisabledReason =
  | 'env_off'
  | 'no_binary'
  | 'daemon_down'
  | null;

export function isPodModeEnabled(): boolean {
  if (process.env.TEST_RUNNER_USE_DOCKER !== '1') return false;
  return dockerStatus().ok;
}

export function podDisabledReason(): PodDisabledReason {
  if (process.env.TEST_RUNNER_USE_DOCKER !== '1') return 'env_off';
  return dockerStatus().reason;
}

// Check whether the pod image is already present on the local Docker host.
// `docker image inspect` exits non-zero when the image is unknown.
//
// IMPORTANT: this lives on the request path of /api/health (via
// podManagerStatus), so we cache the result. Under WSL2 the docker CLI
// proxies to Windows Docker Desktop over a named pipe and a cold
// `docker image inspect` can take several seconds — long enough that
// start.sh's 2s curl health probe times out and the operator sees
// "Backend did not become healthy within 30s" even though the listener
// is up.
//
// Cache TTL mirrors DOCKER_PROBE_TTL_MS so behaviour is consistent: if
// the image is rebuilt or removed externally, recovery happens within
// 30s without a backend restart.
const IMAGE_EXISTS_TTL_MS = 30_000;
const imageExistsCache = new Map<string, { exists: boolean; checkedAt: number }>();

function imageExistsUncached(image: string): boolean {
  const probe = spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' });
  return probe.status === 0;
}

function imageExists(image: string): boolean {
  const now = Date.now();
  const hit = imageExistsCache.get(image);
  if (hit && now - hit.checkedAt < IMAGE_EXISTS_TTL_MS) return hit.exists;
  const exists = imageExistsUncached(image);
  imageExistsCache.set(image, { exists, checkedAt: now });
  return exists;
}

// Lets ensurePodImageBuilt seed the cache with a fresh ground-truth
// answer, so the very first /api/health hit after a successful build
// returns instantly instead of paying the spawnSync cost.
function setImageExistsCache(image: string, exists: boolean): void {
  imageExistsCache.set(image, { exists, checkedAt: Date.now() });
}

// One-shot best-effort build of the per-tester pod image so the operator
// doesn't have to remember a manual `docker build`. Triggered on server
// boot when pod mode is enabled. Idempotent — skipped when the image
// already exists. Failures are logged but never fatal; the runner falls
// back to the local sandbox if the build fails.
export async function ensurePodImageBuilt(): Promise<boolean> {
  if (!isPodModeEnabled()) return false;
  if (imageExists(POD_IMAGE)) {
    masterlistSetImageReady(true);
    return true;
  }
  // The Dockerfile lives at Codebase/Backend/docker/cpp-pod.Dockerfile.
  // We resolve relative to this file so it works whether the backend is
  // run from src/ (ts-node) or dist/ (compiled).
  const candidates = [
    path.join(__dirname, '..', '..', 'docker', 'cpp-pod.Dockerfile'),
    path.join(__dirname, '..', '..', '..', 'docker', 'cpp-pod.Dockerfile'),
    path.join(process.cwd(), 'docker', 'cpp-pod.Dockerfile'),
    path.join(process.cwd(), 'Codebase', 'Backend', 'docker', 'cpp-pod.Dockerfile')
  ];
  const dockerfile = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  if (!dockerfile) {
    // eslint-disable-next-line no-console
    console.warn('[pod-manager] cpp-pod.Dockerfile not found — pod build skipped; runner will use local sandbox');
    return false;
  }
  const buildContext = path.dirname(dockerfile);
  // eslint-disable-next-line no-console
  console.log(`[pod-manager] building ${POD_IMAGE} from ${dockerfile} (this runs once per host)…`);
  // Hard-cap at 5 minutes — fresh image pulls + apk add can take ~60s on
  // slow networks, but anything beyond 5 min is daemon-stuck territory
  // and we'd rather fall back than wedge the boot path.
  const POD_BUILD_TIMEOUT_MS = Number(process.env.POD_BUILD_TIMEOUT_MS || 5 * 60_000);
  return new Promise<boolean>((resolve) => {
    const proc = spawn('docker', ['build', '-f', dockerfile, '-t', POD_IMAGE, buildContext], {
      stdio: 'inherit'
    });
    const t = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[pod-manager] docker build timed out — falling back to local sandbox for now');
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      resolve(false);
    }, POD_BUILD_TIMEOUT_MS);
    proc.on('close', (code) => {
      clearTimeout(t);
      const ok = code === 0;
      // Seed the cache so internal callers don't need to spawn `docker
      // image inspect` to learn what we already know.
      setImageExistsCache(POD_IMAGE, ok);
      // Push the result to the health masterlist so /api/health
      // immediately reflects the new state without waiting for the
      // dockerWatcher's next tick.
      masterlistSetImageReady(ok);
      // eslint-disable-next-line no-console
      console.log(`[pod-manager] build ${ok ? 'succeeded' : 'failed (exit ' + code + ')'}`);
      resolve(ok);
    });
    proc.on('error', (e) => {
      clearTimeout(t);
      // eslint-disable-next-line no-console
      console.warn('[pod-manager] docker build error:', e.message || e);
      resolve(false);
    });
  });
}

// Cached Docker probe — refreshed every 30s so a quick burst of
// health-checks doesn't spam the daemon, but the cache is short enough
// that flipping Docker Desktop on without restarting the backend
// recovers automatically. The probe checks BOTH that `docker` is on
// PATH (PodDisabledReason='no_binary' otherwise) AND that `docker info`
// answers (='daemon_down' when Desktop is closed).
const DOCKER_PROBE_TTL_MS = 30_000;
let cachedDockerOk: { ok: boolean; reason: PodDisabledReason; checkedAt: number } | null = null;

function probeDocker(): { ok: boolean; reason: PodDisabledReason } {
  const which = process.platform === 'win32'
    ? spawnSync('where.exe', ['docker'], { stdio: 'ignore' })
    : spawnSync('which', ['docker'], { stdio: 'ignore' });
  if (which.status !== 0) return { ok: false, reason: 'no_binary' };
  const info = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'],
    { stdio: 'ignore', timeout: 5_000 });
  if (info.status !== 0) return { ok: false, reason: 'daemon_down' };
  return { ok: true, reason: null };
}

function dockerStatus(): { ok: boolean; reason: PodDisabledReason } {
  const now = Date.now();
  if (cachedDockerOk && now - cachedDockerOk.checkedAt < DOCKER_PROBE_TTL_MS) {
    return { ok: cachedDockerOk.ok, reason: cachedDockerOk.reason };
  }
  const r = probeDocker();
  cachedDockerOk = { ...r, checkedAt: now };
  return r;
}

function nowMs(): number { return Date.now(); }

function newPodId(userId: number): { podId: string; containerName: string } {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  const podId = `pod-${userId}-${stamp}-${rand}`;
  // Container names must be DNS-safe and unique across the host.
  const containerName = `nt-${podId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return { podId, containerName };
}

function dockerRunArgs(containerName: string): string[] {
  // The pod runs `sleep` so it stays alive between exec calls. All real
  // work happens through `docker exec` invocations from runPhase.
  const ttlSec = Math.ceil(POD_TTL_MS / 1000) + 30;
  return [
    'run', '-d', '--rm',
    '--name', containerName,
    '--memory', POD_MEMORY,
    '--cpus', POD_CPUS,
    '--network', POD_NETWORK,
    '--pids-limit', POD_PIDS_LIMIT,
    '--read-only',
    // tmpfs default mount options include `noexec`, which silently prevents
    // the just-compiled user binary from running ("exec: no such file or
    // directory"). Add `exec` explicitly so g++ output is runnable; `nosuid`
    // and `nodev` stay on for sandboxing.
    '--tmpfs', '/work:rw,exec,nosuid,nodev,size=8m,mode=1777',
    '-w', '/work',
    POD_IMAGE,
    'sleep', String(ttlSec)
  ];
}

// Public — best-effort. Failures (Docker missing, image pull required, OOM)
// are swallowed so the rest of the auth flow continues; the local fallback
// path in testRunnerService still works.
export async function ensurePod(userId: number, username: string): Promise<PodHandle | null> {
  if (!isPodModeEnabled()) return null;
  // Make sure the image exists before issuing `docker run` — the build
  // call is idempotent (skipped when the image is present) and protects
  // against the case where ensurePod is hit before server boot's
  // background build finishes.
  if (!imageExists(POD_IMAGE)) {
    const built = await ensurePodImageBuilt();
    if (!built) return null;
  }
  const existing = pods.get(userId);
  if (existing && !existing.disposed && existing.expiresAt > nowMs()) {
    // Slide the deadline forward so an active user keeps their pod alive.
    existing.expiresAt = nowMs() + POD_TTL_MS;
    return existing;
  }
  if (existing) await disposePod(userId);

  const { podId, containerName } = newPodId(userId);
  // Bound the `docker run` to 15s so a hung daemon never keeps a caller
  // (or the seat-claim warm-up) alive indefinitely. On timeout we abort
  // and the runner falls back to the local sandbox for this user.
  const POD_RUN_TIMEOUT_MS = Number(process.env.POD_RUN_TIMEOUT_MS || 15_000);
  const ok = await new Promise<boolean>((resolve) => {
    const p = spawn('docker', dockerRunArgs(containerName), { stdio: 'ignore' });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* ignore */ } resolve(false); }, POD_RUN_TIMEOUT_MS);
    p.on('close', (code) => { clearTimeout(t); resolve(code === 0); });
    p.on('error', () => { clearTimeout(t); resolve(false); });
  });
  if (!ok) {
    // eslint-disable-next-line no-console
    console.warn(`[pod-manager] failed to start pod for user ${userId} (${username})`);
    return null;
  }
  const pod: InternalPod = {
    podId,
    containerName,
    userId,
    username,
    createdAt: nowMs(),
    expiresAt: nowMs() + POD_TTL_MS,
    disposed: false
  };
  pods.set(userId, pod);
  // Mirror to the health masterlist so /api/health surfaces the live
  // pod count without any extra docker shellouts.
  masterlistRegisterPod({ userId, containerName, expiresAt: pod.expiresAt });
  // eslint-disable-next-line no-console
  console.log(`[pod-manager] started ${containerName} for user ${userId} (${username})`);
  return pod;
}

// Health-route helper: does the calling user already own a live pod?
// Returns false (rather than throwing) for unknown userIds so the
// /api/health endpoint can call it unconditionally.
export function hasPodForUser(userId: number | null | undefined): boolean {
  if (typeof userId !== 'number' || userId <= 0) return false;
  return getPod(userId) !== null;
}

export function getPod(userId: number): PodHandle | null {
  const p = pods.get(userId);
  if (!p || p.disposed) return null;
  if (p.expiresAt <= nowMs()) return null;
  return p;
}

export async function disposePod(userId: number): Promise<void> {
  const p = pods.get(userId);
  if (!p || p.disposed) return;
  p.disposed = true;
  pods.delete(userId);
  masterlistUnregisterPod(userId);
  await new Promise<void>((resolve) => {
    const proc = spawn('docker', ['rm', '-f', p.containerName], { stdio: 'ignore' });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
  // eslint-disable-next-line no-console
  console.log(`[pod-manager] disposed ${p.containerName}`);
}

export async function disposeAll(): Promise<void> {
  const ids = [...pods.keys()];
  await Promise.all(ids.map(disposePod));
}

// 30-second sweep — kills pods whose TTL has elapsed. Idempotent and
// silent; called automatically from startSweepTimer().
async function sweep(): Promise<void> {
  const now = nowMs();
  const dying: number[] = [];
  for (const [uid, p] of pods) {
    if (p.disposed || p.expiresAt <= now) dying.push(uid);
  }
  await Promise.all(dying.map(disposePod));
}

let sweepTimer: NodeJS.Timeout | null = null;
export function startSweepTimer(): void {
  if (sweepTimer || !isPodModeEnabled()) return;
  sweepTimer = setInterval(() => { void sweep(); }, POD_SWEEP_MS);
  sweepTimer.unref?.();
  // eslint-disable-next-line no-console
  console.log(`[pod-manager] sweep timer started (every ${POD_SWEEP_MS}ms; ttl=${POD_TTL_MS}ms; image=${POD_IMAGE})`);
}

// Server shutdown hook. registerShutdownHooks() wires SIGINT/SIGTERM/
// beforeExit so the server tears down every live pod before exiting —
// "deallocate before dying" per the brief.
let hooksRegistered = false;
export function registerShutdownHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;
  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[pod-manager] ${signal} received — disposing ${pods.size} pod(s)`);
    try { await disposeAll(); } catch { /* ignore */ }
    // Do not call process.exit here — let other shutdown hooks run.
  };
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('beforeExit', () => { void shutdown('beforeExit'); });
}

// Snapshot the manager's state for the /api/health endpoint. Lets the
// frontend status card surface "Docker: online (N pods)" without polling
// `docker ps` itself.
export function podManagerStatus(callerUserId?: number | null): {
  enabled: boolean;
  imageReady: boolean;
  livePods: number;
  reason: PodDisabledReason;
  mine: boolean;
} {
  const enabled = isPodModeEnabled();
  return {
    enabled,
    imageReady: enabled ? imageExists(POD_IMAGE) : false,
    livePods: pods.size,
    reason: enabled ? null : podDisabledReason(),
    mine: hasPodForUser(callerUserId)
  };
}

// Helper used by testRunnerService to run a one-off command inside the
// caller's pod. Returns stdout/stderr/exit code; signals are reported
// through the exit-code surface (Docker exec exits 137 on SIGKILL etc).
export interface PodExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function execInPod(
  pod: PodHandle,
  argv: string[],
  opts: { timeoutMs?: number; stdin?: string } = {}
): Promise<PodExecResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  return new Promise((resolve) => {
    const proc = spawn('docker', ['exec', '-i', pod.containerName, ...argv], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; proc.kill('SIGKILL'); }, timeoutMs);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, exitCode: code ?? -1, timedOut });
    });
    proc.on('error', (e) => {
      clearTimeout(t);
      resolve({ stdout, stderr: stderr + os.EOL + String(e), exitCode: -1, timedOut });
    });
    if (opts.stdin) proc.stdin.write(opts.stdin);
    proc.stdin.end();
  });
}

// Copy a file or directory from the host into the pod. Used by the runner
// to deliver user_class.h, per-file sources, the introspect header, and the
// driver before each compile.
//
// IMPORTANT: `docker cp` is NOT used here. The pod runs with `--read-only`
// rootfs, and the daemon refuses `docker cp` to a read-only container even
// when the destination path is a writable tmpfs ("Error response from
// daemon: container rootfs is marked read-only"). The fix is the standard
// workaround: stream a tar archive of the source through `docker exec`'s
// stdin and untar inside the pod into `podPath`. busybox `tar` (shipped in
// the alpine cpp-pod image) reads from stdin with `-xf -`.
export async function copyIntoPod(
  pod: PodHandle,
  hostPath: string,
  podPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    let stat: fs.Stats;
    try { stat = fs.statSync(hostPath); }
    catch { return resolve(false); }

    // tar from the parent dir using the basename so the archive contains
    // just the leaf entry — matching `docker cp <src> <pod>:<podPath>`'s
    // behaviour where the source's leaf name lands inside `podPath`.
    const srcParent = stat.isDirectory() ? path.dirname(hostPath) : path.dirname(hostPath);
    const srcLeaf   = path.basename(hostPath);

    const tarProc = spawn('tar', ['-cf', '-', '-C', srcParent, srcLeaf], {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const dockerProc = spawn(
      'docker',
      ['exec', '-i', pod.containerName, 'tar', '-xf', '-', '-C', podPath],
      { stdio: ['pipe', 'ignore', 'ignore'] }
    );

    let resolved = false;
    const finish = (ok: boolean): void => {
      if (resolved) return;
      resolved = true;
      try { tarProc.kill('SIGKILL'); } catch { /* ignore */ }
      try { dockerProc.kill('SIGKILL'); } catch { /* ignore */ }
      resolve(ok);
    };

    tarProc.stdout.pipe(dockerProc.stdin);
    tarProc.on('error', () => finish(false));
    dockerProc.on('error', () => finish(false));
    tarProc.on('close', (tarCode) => {
      dockerProc.on('close', (dockerCode) => {
        finish(tarCode === 0 && dockerCode === 0);
      });
    });
  });
}
