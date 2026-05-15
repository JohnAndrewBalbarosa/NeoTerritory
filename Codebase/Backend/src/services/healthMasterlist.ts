/*
 * Health masterlist — single in-process source of truth for the data
 * /api/health serves to the frontend.
 *
 * Three actors:
 *   1. Masterlist (this file) — owns the state, exposes sync getters.
 *   2. Suppliers — write to the masterlist when reality changes:
 *        - dockerWatcher (background poll) → setDockerOnline / setImageReady
 *        - podManager (event-driven)       → registerPod / unregisterPod
 *   3. Consumer — /api/health (analysis.ts) reads via getPublicSnapshot /
 *      getPrivateSnapshot. Never blocks on Docker; if the watcher hasn't
 *      run yet (or Docker is down) the snapshot reads "offline."
 *
 * Public values are checked synchronously at request time because they
 * are cheap (filesystem existence + env-var presence) and the caller
 * needs an authoritative answer immediately. Private values (Docker,
 * pods) are async-supplied so a slow Docker daemon under WSL2 cannot
 * stall the health probe.
 */
import fs from 'fs';
import path from 'path';
import { getAiConfigSnapshot } from '../db/aiConfig';

// ---------- public-side checks (synchronous, cheap) ----------

interface MicroserviceStatus {
  binaryPath: string;
  catalogPath: string;
  binaryFound: boolean;
  catalogFound: boolean;
  connected: boolean;
}

interface AiTranslatorStatus {
  configured: boolean;
  model: string;
  // Where the active config came from. 'db' means the admin set it via
  // the AI admin tab; 'env' means it was baked into the container at
  // deploy time; 'none' means nothing is configured.
  source: 'db' | 'env' | 'none';
  provider: 'anthropic' | 'gemini' | 'none';
}

function resolveMicroserviceBinary(): string {
  // Honour the same env var the analysis service uses (NEOTERRITORY_BIN).
  const explicit = process.env.NEOTERRITORY_BIN || process.env.NEOTERRITORY_BINARY;
  if (explicit && fs.existsSync(explicit)) return explicit;
  // __dirname in tsx dev = src/services/ → up 4 → repo root.
  // __dirname in compiled = dist/src/services/ → up 5 → repo root.
  // Try both depths so we work in both modes.
  const root4 = path.resolve(__dirname, '..', '..', '..', '..');
  const root5 = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const candidates = [
    path.join(root4, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory.exe'),
    path.join(root4, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory'),
    path.join(root4, 'Codebase', 'Microservice', 'build', 'NeoTerritory'),
    path.join(root4, 'Codebase', 'Microservice', 'build-linux', 'NeoTerritory'),
    path.join(root4, 'Codebase', 'Microservice', 'build', 'NeoTerritory.exe'),
    path.join(root5, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory.exe'),
    path.join(root5, 'Codebase', 'Microservice', 'build-wsl', 'NeoTerritory'),
    path.join(root5, 'Codebase', 'Microservice', 'build', 'NeoTerritory'),
    path.join(root5, 'Codebase', 'Microservice', 'build-linux', 'NeoTerritory'),
    path.join(root5, 'Codebase', 'Microservice', 'build', 'NeoTerritory.exe'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function resolveMicroserviceCatalog(): string {
  const explicit = process.env.NEOTERRITORY_CATALOG;
  if (explicit && fs.existsSync(explicit)) return explicit;
  const root4 = path.resolve(__dirname, '..', '..', '..', '..');
  const root5 = path.resolve(__dirname, '..', '..', '..', '..', '..');
  const candidates = [
    path.join(root4, 'Codebase', 'Microservice', 'pattern_catalog'),
    path.join(root5, 'Codebase', 'Microservice', 'pattern_catalog'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

export function getMicroserviceStatus(): MicroserviceStatus {
  const binaryPath = resolveMicroserviceBinary();
  const catalogPath = resolveMicroserviceCatalog();
  const binaryFound = fs.existsSync(binaryPath);
  const catalogFound = fs.existsSync(catalogPath);
  return {
    binaryPath,
    catalogPath,
    binaryFound,
    catalogFound,
    connected: binaryFound && catalogFound,
  };
}

export function getAiTranslatorStatus(): AiTranslatorStatus {
  // 1. DB-backed admin config wins, matching the precedence used by
  //    pickProvider() inside the AI service.
  try {
    const snap = getAiConfigSnapshot();
    if (snap.hasKey && (snap.provider === 'anthropic' || snap.provider === 'gemini')) {
      const fallbackModel = snap.provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-6';
      return {
        configured: true,
        model: snap.model || fallbackModel,
        source: 'db',
        provider: snap.provider,
      };
    }
  } catch { /* fall through */ }

  // 2. Legacy env-var path.
  const gKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const aKey = process.env.ANTHROPIC_API_KEY;
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase();
  const useGemini = (explicit === 'gemini' && gKey) || (!explicit && gKey);
  if (gKey || aKey) {
    return {
      configured: true,
      model: useGemini
        ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash')
        : (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'),
      source: 'env',
      provider: useGemini ? 'gemini' : 'anthropic',
    };
  }
  return { configured: false, model: '', source: 'none', provider: 'none' };
}

// ---------- private-side state (async-supplied) ----------

type PodDisabledReason = 'env_off' | 'no_binary' | 'daemon_down' | null;

interface DockerState {
  online: boolean;
  reason: PodDisabledReason;
  imageReady: boolean;
  lastCheckedAt: number;  // epoch ms; 0 means never checked
}

interface PodEntry {
  userId: number;
  containerName: string;
  expiresAt: number;
}

const dockerState: DockerState = {
  // Default to offline — the watcher flips this true on its first
  // successful tick. /api/health reads "offline" until then, which is
  // exactly what the user asked for: never wait for Docker.
  online: false,
  reason: 'daemon_down',
  imageReady: false,
  lastCheckedAt: 0,
};

const pods = new Map<number, PodEntry>();

export function setDockerOnline(online: boolean, reason: PodDisabledReason = null): void {
  dockerState.online = online;
  dockerState.reason = online ? null : (reason || 'daemon_down');
  dockerState.lastCheckedAt = Date.now();
  // If Docker dropped, image readiness becomes meaningless.
  if (!online) dockerState.imageReady = false;
}

export function setImageReady(ready: boolean): void {
  dockerState.imageReady = ready;
}

export function registerPod(entry: PodEntry): void {
  pods.set(entry.userId, entry);
}

export function unregisterPod(userId: number): void {
  pods.delete(userId);
}

// Snapshot the private state. Never spawns subprocesses.
export interface PrivateSnapshot {
  docker: {
    online: boolean;
    reason: PodDisabledReason;
    imageReady: boolean;
    lastCheckedAt: number;
    livePods: number;
    mine: boolean;
  };
}

export function getPrivateSnapshot(callerUserId?: number | null): PrivateSnapshot {
  const mine = typeof callerUserId === 'number' && callerUserId > 0
    ? pods.has(callerUserId)
    : false;
  return {
    docker: {
      online: dockerState.online,
      reason: dockerState.reason,
      imageReady: dockerState.imageReady,
      lastCheckedAt: dockerState.lastCheckedAt,
      livePods: pods.size,
      mine,
    },
  };
}

// Test/diagnostic helper. Not exposed on /api/health.
export function getRawState(): { docker: DockerState; podCount: number } {
  return { docker: { ...dockerState }, podCount: pods.size };
}
