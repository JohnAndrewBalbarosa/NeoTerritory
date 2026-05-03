// Best-effort mirror of admin/audit log events into Supabase via the REST API
// (PostgREST). Local SQLite is always the source of truth — Supabase is a
// secondary sink so the data survives an AWS spot-instance termination.
//
// Activated only when SUPABASE_URL and SUPABASE_SERVICE_KEY are both set in
// the environment. In local development with neither set, this module is a
// no-op and the backend behaves exactly as before.
//
// All network calls are fire-and-forget: failure to reach Supabase must never
// break a request, so errors are logged once and swallowed.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const TABLE_LOGS = process.env.SUPABASE_LOGS_TABLE || 'admin_logs';
const TABLE_AUDIT = process.env.SUPABASE_AUDIT_TABLE || 'admin_audit_log';

const enabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

let warnedOnce = false;

interface LogRow {
  user_id: number | null;
  event_type: string;
  message: string;
  created_at: string;
}

interface AuditRow {
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  target_kind: string;
  target_id: string | null;
  detail: string | null;
  created_at: string;
}

async function postRow(table: string, row: LogRow | AuditRow): Promise<void> {
  if (!enabled) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!res.ok && !warnedOnce) {
      warnedOnce = true;
      const txt = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.warn(`[supabaseLogger] mirror failed (${res.status}): ${txt.slice(0, 200)}`);
    }
  } catch (err) {
    if (!warnedOnce) {
      warnedOnce = true;
      // eslint-disable-next-line no-console
      console.warn('[supabaseLogger] mirror unreachable:', err instanceof Error ? err.message : err);
    }
  }
}

export function isSupabaseLoggerEnabled(): boolean {
  return enabled;
}

export function mirrorLogEvent(userId: number | null, eventType: string, message: string): void {
  if (!enabled) return;
  void postRow(TABLE_LOGS, {
    user_id: userId,
    event_type: eventType,
    message,
    created_at: new Date().toISOString(),
  });
}

export function mirrorAuditEvent(entry: {
  actorUserId: number | null;
  actorUsername: string | null;
  action: string;
  targetKind: string;
  targetId?: string | null;
  detail?: string | null;
}): void {
  if (!enabled) return;
  void postRow(TABLE_AUDIT, {
    actor_user_id: entry.actorUserId,
    actor_username: entry.actorUsername,
    action: entry.action,
    target_kind: entry.targetKind,
    target_id: entry.targetId ?? null,
    detail: entry.detail ?? null,
    created_at: new Date().toISOString(),
  });
}
