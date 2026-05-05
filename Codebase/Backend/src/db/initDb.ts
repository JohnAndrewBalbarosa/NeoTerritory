import bcrypt from 'bcryptjs';
import db from './database';
import { initEtlSchema } from './etlSchema';
// TEST SEED — REMOVE FOR PRODUCTION (delete _testSeed/ + this import + the calls below)
import { seedDevconUsers, ensureTestFolders } from './_testSeed/devconUsers';

const DEFAULT_ADMIN_USERNAME = 'Neoterritory';
const DEFAULT_ADMIN_PASSWORD = 'ragabag123';

interface PragmaColumnRow { name: string }
interface UserAdminRow { id: number; role: string }

function columnExists(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as PragmaColumnRow[];
  return rows.some((r) => r.name === column);
}

function seedAdminAccount(): void {
  const username = process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD
    || process.env.SEED_ADMIN_PASSWORD
    || DEFAULT_ADMIN_PASSWORD;
  const email = `${username.toLowerCase()}@neoterritory.local`;
  const hash = bcrypt.hashSync(password, 10);

  const existing = db
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(username) as UserAdminRow | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'admin', datetime('now'))`
    ).run(username, email, hash);
    return;
  }

  // Idempotent upsert: ensure role is admin and password matches env.
  db.prepare(`UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?`)
    .run(hash, existing.id);
}

export function initDb(): void {
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  )`).run();
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`).run();

  if (!columnExists('users', 'role')) {
    db.prepare(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`).run();
  }
  if (!columnExists('users', 'claimed_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN claimed_at TEXT`).run();
  }
  if (!columnExists('users', 'last_active')) {
    db.prepare(`ALTER TABLE users ADD COLUMN last_active TEXT`).run();
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    input_file_path TEXT NOT NULL,
    output_file_path TEXT NOT NULL,
    job_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();

  // Audit log — append-only record of destructive admin actions (deletions
  // of runs and bulk log purges). Intentionally separate from `logs` because
  // the admin UI exposes a "Delete all logs" control; this table is never
  // exposed to that delete and has no DELETE route. Source of accountability.
  db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    actor_username TEXT,
    action TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS analysis_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    artifact_path TEXT NOT NULL,
    structure_score INTEGER NOT NULL,
    modernization_score INTEGER NOT NULL,
    findings_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`).run();

  // Migration: add user_id column to analysis_runs if missing
  if (!columnExists('analysis_runs', 'user_id')) {
    db.prepare(`ALTER TABLE analysis_runs ADD COLUMN user_id INTEGER`).run();
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scope TEXT NOT NULL,
    analysis_run_id INTEGER,
    answers_json TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_reviews_scope ON reviews(scope)`).run();

  initEtlSchema(db);

  // --- Survey + manual-review tables (idempotent) ---
  db.prepare(`CREATE TABLE IF NOT EXISTS survey_consent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    accepted_at TEXT NOT NULL,
    version TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_survey_consent_user ON survey_consent(user_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS survey_pretest (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    answers_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_survey_pretest_user ON survey_pretest(user_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS run_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    ratings_json TEXT NOT NULL,
    open_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_feedback_user ON run_feedback(user_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_run_feedback_run ON run_feedback(run_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS session_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_uuid TEXT NOT NULL,
    ratings_json TEXT NOT NULL,
    open_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_session_feedback_user ON session_feedback(user_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS manual_pattern_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    line INTEGER NOT NULL,
    candidates_json TEXT NOT NULL,
    chosen_pattern TEXT,
    chosen_kind TEXT NOT NULL,
    other_text TEXT,
    decided_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(run_id) REFERENCES analysis_runs(id)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_decisions_run ON manual_pattern_decisions(run_id)`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_decisions_user ON manual_pattern_decisions(user_id)`).run();

  // ── ON DELETE CASCADE migration ────────────────────────────────────────
  // SQLite can't ALTER an existing foreign key to add CASCADE — we have
  // to recreate the table. We do this once, idempotently, by checking
  // whether the existing FK definition mentions "CASCADE". If it
  // doesn't, we copy the data into a new table that does, then swap.
  // Wrapped in a transaction so a partial failure rolls back.
  function ensureCascade(table: string, recreateSql: string): void {
    try {
      const sqlRow = db.prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
      ).get(table) as { sql?: string } | undefined;
      const sql = sqlRow?.sql || '';
      if (sql.toUpperCase().includes('ON DELETE CASCADE')) return;
      db.exec('PRAGMA foreign_keys = OFF;');
      db.transaction(() => {
        db.exec(`ALTER TABLE ${table} RENAME TO ${table}__old;`);
        db.exec(recreateSql);
        const colsRow = db.prepare(
          `SELECT group_concat(name) AS cols FROM pragma_table_info(?)`
        ).get(`${table}__old`) as { cols?: string } | undefined;
        const cols = colsRow?.cols || '*';
        db.exec(`INSERT INTO ${table} (${cols}) SELECT ${cols} FROM ${table}__old;`);
        db.exec(`DROP TABLE ${table}__old;`);
      })();
      db.exec('PRAGMA foreign_keys = ON;');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[initDb] cascade migration for ${table} skipped:`, err);
    }
  }

  ensureCascade('reviews', `
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      analysis_run_id INTEGER,
      answers_json TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    )
  `);
  ensureCascade('manual_pattern_decisions', `
    CREATE TABLE manual_pattern_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      line INTEGER NOT NULL,
      candidates_json TEXT NOT NULL,
      chosen_pattern TEXT,
      chosen_kind TEXT NOT NULL,
      other_text TEXT,
      decided_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
    )
  `);

  // TEST SEED — REMOVE FOR PRODUCTION
  seedDevconUsers(db);
  ensureTestFolders();

  seedAdminAccount();
}
