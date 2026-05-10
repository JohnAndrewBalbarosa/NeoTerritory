/**
 * Per-run, in-memory event bus for the test-runner pipeline.
 *
 * One run-id covers a complete invocation of /api/analysis/run-tests:
 *   compile_run for every eligible pattern, then unit_test for every
 *   eligible pattern. The frontend receives each phase result the moment
 *   it resolves (via the SSE endpoint that consumes this store) instead
 *   of waiting for the whole batch to finish.
 *
 * Idempotency contract:
 *   pushPhaseEvent({ runId, phase, patternId }) is a no-op if the same
 *   (runId, phase, patternId) tuple has already been emitted. This is the
 *   guarantee that lets a future out-of-process pod retry its callback
 *   without duplicating UI rows.
 */
import type { TestPhase, TestResult } from './testRunnerService';

// One phase resolving for one pattern. Same shape the legacy blocking
// response returned, plus a monotonic seq the FE uses to ack/replay.
export interface RunPhaseEvent {
  type: 'phase';
  runId: string;
  seq: number;
  result: TestResult;
}

export interface RunDoneEvent {
  type: 'done';
  runId: string;
  seq: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  rateLimit?: { window: number; cooldownMs: number; remaining: number };
}

export type RunEvent = RunPhaseEvent | RunDoneEvent;

export type RunSubscriber = (event: RunEvent) => void;

interface RunRecord {
  runId: string;
  userId: number;
  events: RunEvent[];
  seenKeys: Set<string>;
  done: boolean;
  subscribers: Set<RunSubscriber>;
  createdAt: number;
  doneAt: number | null;
}

// 15-minute TTL after a run finishes; long enough for a tester to
// reconnect their browser and replay the result, short enough that the
// in-memory store does not grow unbounded.
const RUN_TTL_MS = 15 * 60 * 1000;
// Cap on concurrent runs ever held in memory. If exceeded, the oldest
// finished run is evicted first; in-flight runs are never evicted.
const MAX_RUNS = 500;

const runs = new Map<string, RunRecord>();

function evictExpired(): void {
  const now = Date.now();
  for (const [runId, rec] of runs) {
    if (rec.done && rec.doneAt && now - rec.doneAt > RUN_TTL_MS) {
      runs.delete(runId);
    }
  }
  if (runs.size > MAX_RUNS) {
    const finished = [...runs.values()]
      .filter(r => r.done)
      .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0));
    while (runs.size > MAX_RUNS && finished.length > 0) {
      const victim = finished.shift();
      if (victim) runs.delete(victim.runId);
    }
  }
}

/**
 * Reserve a runId. Returns false if the runId already exists for any
 * owner — callers must generate fresh ids per click.
 */
export function reserveRun(runId: string, userId: number): boolean {
  evictExpired();
  if (runs.has(runId)) return false;
  runs.set(runId, {
    runId,
    userId,
    events: [],
    seenKeys: new Set(),
    done: false,
    subscribers: new Set(),
    createdAt: Date.now(),
    doneAt: null
  });
  return true;
}

/**
 * Returns the runId currently in flight for this user, if any. Used to
 * implement the "reject second run while one is already running" rule
 * — we hand the FE the existing runId so it can resubscribe to the SSE
 * stream instead of spawning a duplicate run.
 */
export function findActiveRunFor(userId: number): string | null {
  for (const rec of runs.values()) {
    if (rec.userId === userId && !rec.done) return rec.runId;
  }
  return null;
}

export function getRun(runId: string): { userId: number; done: boolean } | null {
  const rec = runs.get(runId);
  if (!rec) return null;
  return { userId: rec.userId, done: rec.done };
}

/**
 * Append a phase result to the run's event log. De-duped by
 * (phase, patternId) — emitting the same key twice is a no-op so a
 * retrying pod cannot duplicate UI rows.
 */
export function pushPhaseEvent(runId: string, phase: TestPhase, result: TestResult): void {
  const rec = runs.get(runId);
  if (!rec || rec.done) return;
  const key = `${phase}:${result.patternId}`;
  if (rec.seenKeys.has(key)) return;
  rec.seenKeys.add(key);
  const event: RunPhaseEvent = {
    type: 'phase',
    runId,
    seq: rec.events.length,
    result
  };
  rec.events.push(event);
  for (const cb of rec.subscribers) {
    try { cb(event); } catch { /* subscriber failure must not poison others */ }
  }
}

/**
 * Mark the run finished and notify subscribers. Idempotent: a second
 * call with the same runId is a no-op.
 */
export function markRunDone(
  runId: string,
  summary: RunDoneEvent['summary'],
  rateLimit?: RunDoneEvent['rateLimit']
): void {
  const rec = runs.get(runId);
  if (!rec || rec.done) return;
  rec.done = true;
  rec.doneAt = Date.now();
  const event: RunDoneEvent = {
    type: 'done',
    runId,
    seq: rec.events.length,
    summary,
    rateLimit
  };
  rec.events.push(event);
  for (const cb of rec.subscribers) {
    try { cb(event); } catch { /* ignore */ }
  }
  rec.subscribers.clear();
}

/**
 * Subscribe to a run. Replays buffered events synchronously, then
 * streams new ones. Returns an unsubscribe function. If the run is
 * already done, the subscriber is invoked once with the buffered tail
 * and never registered.
 */
export function subscribeRun(runId: string, cb: RunSubscriber): () => void {
  const rec = runs.get(runId);
  if (!rec) return () => { /* no-op */ };
  for (const ev of rec.events) {
    try { cb(ev); } catch { /* ignore */ }
  }
  if (rec.done) return () => { /* no-op, run already terminal */ };
  rec.subscribers.add(cb);
  return () => { rec.subscribers.delete(cb); };
}

// Test-only: drop everything. Exposed so the future jest harness can
// reset state between cases without restarting the process.
export function _resetRunEventsStoreForTests(): void {
  runs.clear();
}
