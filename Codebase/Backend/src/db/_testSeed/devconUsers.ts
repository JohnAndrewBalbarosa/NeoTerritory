/*
 * TEST USER SEED — REMOVE FOR PRODUCTION
 * ---------------------------------------
 * Seeds N test accounts: devcon1..devconN with password "devcon".
 * Gated by env var SEED_TEST_USERS=1. Idempotent (skips existing usernames).
 * N is read from env MAX_TEST_USERS (default 100) at call time.
 *
 * To remove for production:
 *   1. Delete this directory: Codebase/Backend/src/db/_testSeed/
 *   2. Remove the import + call in src/db/initDb.ts (search for "TEST SEED")
 */
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import type { Database as DatabaseType } from 'better-sqlite3';
import db = require('../database');

export interface TestAccountState {
  username: string;
  claimed: boolean;
}

const DEFAULT_TEST_USER_COUNT = 100;
const TEST_USERNAME_PREFIX = 'devcon';
const TEST_PASSWORD = 'devcon';
const TEST_EMAIL_DOMAIN = 'test.local';

function readMaxTestUsers(): number {
  const raw = process.env.MAX_TEST_USERS;
  if (!raw) return DEFAULT_TEST_USER_COUNT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TEST_USER_COUNT;
  return parsed;
}

export function ensureTestFolders(): void {
  if (process.env.SEED_TEST_USERS !== '1') return;
  const count = readMaxTestUsers();
  const testRoot = process.env.TEST_RESULTS_DIR
    || path.join(__dirname, '..', '..', '..', '..', '..', 'test');
  if (!fs.existsSync(testRoot)) fs.mkdirSync(testRoot, { recursive: true });
  let created = 0;
  for (let i = 1; i <= count; i += 1) {
    const dir = path.join(testRoot, `${TEST_USERNAME_PREFIX}${i}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created += 1;
    }
  }
  if (created > 0) console.log(`[seed] Created ${created} missing devcon folder(s) under ${testRoot}.`);
}

export function listTestAccounts(): TestAccountState[] {
  const count = readMaxTestUsers();
  const usernames = Array.from(
    { length: count },
    (_, i) => `${TEST_USERNAME_PREFIX}${i + 1}`
  );

  const placeholders = usernames.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT username, claimed_at FROM users WHERE username IN (${placeholders})`
    )
    .all(...usernames) as ReadonlyArray<{ username: string; claimed_at: string | null }>;
  const claimedSet = new Set(
    rows.filter((r) => r.claimed_at != null).map((r) => r.username)
  );

  return usernames.map((username) => ({
    username,
    claimed: claimedSet.has(username)
  }));
}

export function claimTestAccount(username: string): { ok: true } | { ok: false; reason: 'not_found' | 'already_claimed' } {
  const row = db
    .prepare('SELECT id, username, claimed_at FROM users WHERE username = ?')
    .get(username) as { id: number; username: string; claimed_at: string | null } | undefined;
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.claimed_at != null) return { ok: false, reason: 'already_claimed' };
  db.prepare("UPDATE users SET claimed_at = datetime('now') WHERE id = ? AND claimed_at IS NULL")
    .run(row.id);
  return { ok: true };
}

export function releaseTestAccount(username: string): boolean {
  const result = db
    .prepare('UPDATE users SET claimed_at = NULL WHERE username = ?')
    .run(username);
  return result.changes > 0;
}

export function seedDevconUsers(db: DatabaseType): void {
  if (process.env.SEED_TEST_USERS !== '1') return;
  const count = readMaxTestUsers();

  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO users (username, email, password_hash, role, created_at)
     VALUES (?, ?, ?, 'user', datetime('now'))`
  );

  let inserted = 0;
  const txn = db.transaction(() => {
    for (let i = 1; i <= count; i += 1) {
      const username = `${TEST_USERNAME_PREFIX}${i}`;
      const email = `${username}@${TEST_EMAIL_DOMAIN}`;
      const result = insert.run(username, email, hash);
      if (result.changes > 0) inserted += 1;
    }
  });
  txn();

  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} devcon test user(s).`);
  }
}
