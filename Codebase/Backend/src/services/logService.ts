import db from '../db/database';

function logEvent(userId: number | null, eventType: string, message: string): void {
  db.prepare("INSERT INTO logs (user_id, event_type, message, created_at) VALUES (?, ?, ?, datetime('now'))")
    .run(userId ?? null, eventType, message);
}

// Append-only audit trail for destructive admin actions. Never exposed to
// the bulk "Delete logs" route — that's the whole point. Use for run
// deletions, log purges, and any future admin-side destructive op.
interface AuditEntry {
  actorUserId: number | null;
  actorUsername: string | null;
  action: string;
  targetKind: string;
  targetId?: string | null;
  detail?: string | null;
}

function logAudit(entry: AuditEntry): void {
  db.prepare(
    `INSERT INTO audit_log
       (actor_user_id, actor_username, action, target_kind, target_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    entry.actorUserId ?? null,
    entry.actorUsername ?? null,
    entry.action,
    entry.targetKind,
    entry.targetId ?? null,
    entry.detail ?? null
  );
}

export { logEvent, logAudit };
