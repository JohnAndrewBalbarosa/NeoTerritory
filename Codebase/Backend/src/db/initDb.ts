import bcrypt from 'bcrypt';
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

  // TEST SEED — REMOVE FOR PRODUCTION
  seedDevconUsers(db);
  ensureTestFolders();

  seedAdminAccount();
}
