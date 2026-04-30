import db from '../db/database';

function logEvent(userId: number | null, eventType: string, message: string): void {
  db.prepare("INSERT INTO logs (user_id, event_type, message, created_at) VALUES (?, ?, ?, datetime('now'))")
    .run(userId ?? null, eventType, message);
}

export { logEvent };
