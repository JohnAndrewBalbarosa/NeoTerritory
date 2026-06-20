import type { Database } from 'better-sqlite3';

// Delete ONE intern account (users.role = 'user') and all of their owned data,
// in a single transaction.
//
// Safety:
//  - Only ever removes a row whose role is 'user'. Admins and guests are
//    refused (reason 'not_intern') so this can never delete a PM/admin account.
//  - The set of dependent tables is DISCOVERED from the live schema's foreign
//    keys to users(id) (PRAGMA foreign_key_list), so it cannot drift out of sync
//    as tables are added. NOT NULL references are deleted (the intern owns them);
//    nullable references are nulled (shared content like authored learning
//    modules / org catalogs is disowned, never deleted).
//  - analysis_runs.user_id is a plain column (no enforced FK); it is cleaned
//    explicitly so no orphaned runs are left behind.
//  - Explicit child-first deletes mean it is correct whether or not
//    `PRAGMA foreign_keys` is ON for the connection, and leaves no orphans.

export interface DeleteInternResult {
  ok: boolean;
  reason?: 'not_found' | 'not_intern';
  username?: string;
  email?: string | null;
  rowsByTable?: Record<string, number>;
}

export function deleteInternAndData(db: Database, internId: number): DeleteInternResult {
  const user = db
    .prepare('SELECT id, username, email, role FROM users WHERE id = ?')
    .get(internId) as { id: number; username: string; email: string | null; role: string } | undefined;
  if (!user) return { ok: false, reason: 'not_found' };
  if (user.role !== 'user') return { ok: false, reason: 'not_intern', username: user.username };

  // Discover every enforced FK to users(id), with each column's NOT NULL flag.
  type Ref = { table: string; column: string; notnull: boolean };
  const refs: Ref[] = [];
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all() as Array<{ name: string }>;
  for (const { name } of tables) {
    if (name === 'users') continue;
    const fks = db.prepare(`PRAGMA foreign_key_list(${name})`).all() as Array<{ table: string; from: string }>;
    if (!fks.some((fk) => fk.table === 'users')) continue;
    const cols = db.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string; notnull: number }>;
    for (const fk of fks) {
      if (fk.table !== 'users') continue;
      const col = cols.find((c) => c.name === fk.from);
      refs.push({ table: name, column: fk.from, notnull: col ? !!col.notnull : true });
    }
  }

  const rowsByTable: Record<string, number> = {};
  const exec = (label: string, sql: string): void => {
    const info = db.prepare(sql).run(internId);
    if (info.changes) rowsByTable[label] = info.changes;
  };

  const tableNames = new Set(tables.map((t) => t.name));

  const tx = db.transaction(() => {
    // Non-FK column first: clears runs owned by this intern.
    const arCols = db.prepare(`PRAGMA table_info(analysis_runs)`).all() as Array<{ name: string }>;
    if (arCols.some((c) => c.name === 'user_id')) {
      exec('analysis_runs', `DELETE FROM analysis_runs WHERE user_id = ?`);
    }
    // Plan-scoped children cascade off learning_plans(id), not users(id), so
    // they are not in the users-FK sweep. With FK enforcement disabled (below)
    // the cascade won't fire either, so delete them explicitly BEFORE the plans
    // are removed — otherwise plan-module rows would be orphaned.
    if (tableNames.has('learning_plan_modules')) {
      exec(
        'learning_plan_modules',
        `DELETE FROM learning_plan_modules WHERE plan_id IN (SELECT id FROM learning_plans WHERE learner_id = ?)`,
      );
    }
    for (const ref of refs) {
      if (ref.notnull) {
        exec(ref.table, `DELETE FROM ${ref.table} WHERE ${ref.column} = ?`);
      } else {
        // Disown shared content rather than delete it.
        exec(`${ref.table}.${ref.column}`, `UPDATE ${ref.table} SET ${ref.column} = NULL WHERE ${ref.column} = ?`);
      }
    }
    exec('users', `DELETE FROM users WHERE id = ? AND role = 'user'`);
  });

  // FK enforcement is ON for this connection (initDb enables it). A hard
  // multi-table delete can trip SQLITE_MISMATCH ("datatype mismatch") when an
  // ON DELETE cascade walks a child whose key affinity differs on an
  // older/migrated database. We already delete every child explicitly by
  // user_id above, so FK cascades are not needed: disable enforcement for the
  // duration (pragmas cannot change mid-transaction, so toggle around it — safe
  // because better-sqlite3 runs synchronously) and restore it afterward. No
  // cascades, no per-row type checks, no orphans left behind.
  const fkOn = db.pragma('foreign_keys', { simple: true }) === 1;
  if (fkOn) db.pragma('foreign_keys = OFF');
  try {
    tx();
  } finally {
    if (fkOn) db.pragma('foreign_keys = ON');
  }

  return { ok: true, username: user.username, email: user.email, rowsByTable };
}
