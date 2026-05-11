/**
 * Buffered, survey-gated persistence for test-run details.
 *
 * Project owner rule (very specific): NOTHING about a test-run's
 * compile/unit verdicts may land in the database until the user submits
 * the run-feedback survey for that run. Until then the verdicts live
 * here, in memory.
 *
 * Why this matters: today the admin "compile_run / unit_test" event
 * stream filled up the moment a tester clicked "Run tests", which let
 * partial / abandoned sessions pollute analytics. This module is the
 * gate.
 *
 * Lifecycle:
 *   1. dispatchPatternTests finishes → record({ pendingId, summary, rows })
 *   2. user saves the run            → bindRunId(pendingId, runId)
 *   3. user submits survey for runId → flush(runId, txn) inside the
 *                                     same SQLite transaction as the
 *                                     survey insert
 *   4. user never submits survey     → entry evicts after FLUSH_TTL_MS
 *
 * Both keys (pendingId AND runId) point to the same buffered payload —
 * survey submission may arrive keyed by either depending on whether the
 * user saved the run before submitting feedback.
 */
import db from '../db/database';
import { logEvent } from './logService';

export interface BufferedLogRow {
  eventType: string;
  message: string;
}

export interface BufferedRunRecord {
  userId: number | null;
  pendingId: string | null;
  runId: number | null;
  rows: BufferedLogRow[];
  summary: { total: number; passed: number; failed: number; taggedPatterns: string[] };
  bufferedAt: number;
  flushed: boolean;
}

// 24-hour TTL — long enough that a tester finishing the survey the
// next day still has their data captured, short enough that the
// in-memory store does not grow unbounded across a long-running
// process. Eviction runs lazily on every record() call.
const FLUSH_TTL_MS = 24 * 60 * 60 * 1000;

const byPendingId = new Map<string, BufferedRunRecord>();
const byRunId     = new Map<number, BufferedRunRecord>();

function evictExpired(): void {
  const cutoff = Date.now() - FLUSH_TTL_MS;
  for (const [k, rec] of byPendingId) {
    if (rec.bufferedAt < cutoff) byPendingId.delete(k);
  }
  for (const [k, rec] of byRunId) {
    if (rec.bufferedAt < cutoff) byRunId.delete(k);
  }
}

/**
 * Buffer a finished run's log rows + summary. Replaces any existing
 * entry for the same key (re-runs against the same pending overwrite).
 */
export function recordRun(input: {
  userId: number | null;
  pendingId: string | null;
  runId: number | null;
  rows: BufferedLogRow[];
  summary: BufferedRunRecord['summary'];
}): void {
  evictExpired();
  const rec: BufferedRunRecord = {
    userId: input.userId,
    pendingId: input.pendingId,
    runId: input.runId,
    rows: input.rows,
    summary: input.summary,
    bufferedAt: Date.now(),
    flushed: false
  };
  if (input.pendingId) byPendingId.set(input.pendingId, rec);
  if (input.runId != null) byRunId.set(input.runId, rec);
}

/**
 * Called when a pending run gets saved — bind its numeric runId so the
 * survey-submit handler can find it by either key.
 */
export function bindRunIdToPending(pendingId: string, runId: number): void {
  const rec = byPendingId.get(pendingId);
  if (!rec) return;
  rec.runId = runId;
  byRunId.set(runId, rec);
}

/**
 * Flush the buffered rows for a runId. Called from inside the survey
 * submission's transaction so all writes commit or roll back together.
 * Idempotent — flushing the same record twice is a no-op (the second
 * call observes flushed=true and returns).
 */
export function flushForRunId(runId: number): { flushed: boolean; rowsWritten: number } {
  const rec = byRunId.get(runId);
  if (!rec || rec.flushed) return { flushed: false, rowsWritten: 0 };

  const writeAll = db.transaction(() => {
    for (const row of rec.rows) {
      logEvent(rec.userId, row.eventType, row.message);
    }
    logEvent(rec.userId, 'gdb.run.complete', JSON.stringify({
      ...rec.summary,
      runId
    }));
  });
  writeAll();
  rec.flushed = true;
  // Drop both keys after a successful flush so a re-submit does not
  // double-write. The 24h TTL would handle this anyway, but the explicit
  // delete keeps the maps small.
  if (rec.pendingId) byPendingId.delete(rec.pendingId);
  byRunId.delete(runId);
  return { flushed: true, rowsWritten: rec.rows.length + 1 };
}

// Test/diagnostic helpers — exposed so admin debugging or jest can
// inspect the in-memory state without poking module internals.
export function _peekPendingForTests(pendingId: string): BufferedRunRecord | undefined {
  return byPendingId.get(pendingId);
}
export function _peekRunForTests(runId: number): BufferedRunRecord | undefined {
  return byRunId.get(runId);
}
export function _resetPendingRunPersistenceForTests(): void {
  byPendingId.clear();
  byRunId.clear();
}
