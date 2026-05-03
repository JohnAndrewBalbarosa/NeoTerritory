/*
 * Docker watcher — background actor that probes the Docker daemon and
 * the pod image, then writes the result into healthMasterlist.
 *
 * /api/health never calls this directly. The whole point of the
 * masterlist pattern is that the request-handler reads cached state and
 * is never blocked by a slow Docker Desktop named-pipe round-trip.
 *
 * Cadence: every DOCKER_WATCH_INTERVAL_MS (default 4 s). Each probe
 * has a hard timeout so a wedged daemon can never wedge the watcher.
 *
 * Failure modes:
 *   - `docker` not on PATH       → online=false, reason='no_binary'
 *   - daemon unreachable / slow  → online=false, reason='daemon_down'
 *   - image absent               → online=true,  imageReady=false
 *   - image present              → online=true,  imageReady=true
 */
import { spawnSync } from 'child_process';
import { setDockerOnline, setImageReady } from './healthMasterlist';

const POD_IMAGE = process.env.POD_IMAGE || 'neoterritory/cpp-pod:latest';
const DOCKER_WATCH_INTERVAL_MS = Number(process.env.DOCKER_WATCH_INTERVAL_MS || 4_000);
const PROBE_TIMEOUT_MS = 3_000;

let timer: NodeJS.Timeout | null = null;
let inFlight = false;

function probeDocker(): { online: boolean; reason: 'no_binary' | 'daemon_down' | null } {
  // 1. Is `docker` on PATH at all?
  const which = process.platform === 'win32'
    ? spawnSync('where.exe', ['docker'], { stdio: 'ignore' })
    : spawnSync('which',     ['docker'], { stdio: 'ignore' });
  if (which.status !== 0) return { online: false, reason: 'no_binary' };

  // 2. Is the daemon answering?
  const info = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    stdio:   'ignore',
    timeout: PROBE_TIMEOUT_MS,
  });
  if (info.status !== 0) return { online: false, reason: 'daemon_down' };
  return { online: true, reason: null };
}

function probeImage(): boolean {
  const probe = spawnSync('docker', ['image', 'inspect', POD_IMAGE], {
    stdio:   'ignore',
    timeout: PROBE_TIMEOUT_MS,
  });
  return probe.status === 0;
}

function tick(): void {
  if (inFlight) return;     // skip overlapping ticks
  inFlight = true;
  try {
    const docker = probeDocker();
    setDockerOnline(docker.online, docker.reason);
    if (docker.online) {
      setImageReady(probeImage());
    }
  } catch {
    // Defensive — spawnSync shouldn't throw, but if it does we keep
    // the masterlist in its previous state and try again next tick.
  } finally {
    inFlight = false;
  }
}

export function startDockerWatcher(): void {
  if (timer) return;
  // Run one tick immediately so the masterlist isn't stuck on the
  // boot-time "offline" default for DOCKER_WATCH_INTERVAL_MS seconds.
  // This is the only synchronous cost the watcher imposes — it runs
  // off the boot path, after app.listen, in server.ts.
  tick();
  timer = setInterval(tick, DOCKER_WATCH_INTERVAL_MS);
  timer.unref?.();
  // eslint-disable-next-line no-console
  console.log(`[docker-watcher] started (every ${DOCKER_WATCH_INTERVAL_MS}ms; image=${POD_IMAGE})`);
}

export function stopDockerWatcher(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
