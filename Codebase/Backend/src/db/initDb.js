const bcrypt = require('bcrypt');
const db = require('./database');
const { initEtlSchema } = require('./etlSchema');
// TEST SEED — REMOVE FOR PRODUCTION (delete _testSeed/ + this require + the calls below)
const { seedDevconUsers, ensureTestFolders } = require('./_testSeed/devconUsers');

const ADMIN_USERNAME = 'Neoterritory';
const ADMIN_EMAIL = 'admin@neoterritory.local';

function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === column);
}

function seedAdminAccount() {
  const existing = db.prepare('SELECT id, role FROM users WHERE username = ?').get(ADMIN_USERNAME);
  const password = process.env.SEED_ADMIN_PASSWORD || 'ragabag123';
  const hash = bcrypt.hashSync(password, 10);
  if (!existing) {
    db.prepare(
      `INSERT INTO users (username, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'admin', datetime('now'))`
    ).run(ADMIN_USERNAME, ADMIN_EMAIL, hash);
    return;
  }
  if (existing.role !== 'admin') {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(existing.id);
  }
}

function initDb() {
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
  if (!columnExists('users', 'public_key_pem')) {
    db.prepare(`ALTER TABLE users ADD COLUMN public_key_pem TEXT`).run();
  }
  if (!columnExists('users', 'public_key_fingerprint')) {
    db.prepare(`ALTER TABLE users ADD COLUMN public_key_fingerprint TEXT`).run();
  }
  if (!columnExists('users', 'key_algorithm')) {
    db.prepare(`ALTER TABLE users ADD COLUMN key_algorithm TEXT`).run();
  }
  if (!columnExists('users', 'key_assigned_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN key_assigned_at TEXT`).run();
  }
  if (!columnExists('users', 'private_key_pem')) {
    db.prepare(`ALTER TABLE users ADD COLUMN private_key_pem TEXT`).run();
  }
  if (!columnExists('users', 'seat_status')) {
    db.prepare(`ALTER TABLE users ADD COLUMN seat_status TEXT NOT NULL DEFAULT 'available'`).run();
  }
  if (!columnExists('users', 'seat_claimed_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN seat_claimed_at TEXT`).run();
  }
  if (!columnExists('users', 'seat_expires_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN seat_expires_at TEXT`).run();
  }
  if (!columnExists('users', 'last_heartbeat_at')) {
    db.prepare(`ALTER TABLE users ADD COLUMN last_heartbeat_at TEXT`).run();
  }
  if (!columnExists('users', 'seat_claim_token')) {
    db.prepare(`ALTER TABLE users ADD COLUMN seat_claim_token TEXT`).run();
  }
  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_key_fingerprint
     ON users(public_key_fingerprint)
     WHERE public_key_fingerprint IS NOT NULL`
  ).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_seat_status ON users(seat_status)`).run();

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

module.exports = { initDb };
