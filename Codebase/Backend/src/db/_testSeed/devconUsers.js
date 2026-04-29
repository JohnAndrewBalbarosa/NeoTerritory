/*
 * TEST USER SEED — REMOVE FOR PRODUCTION
 * ---------------------------------------
 * Seeds 100 test accounts: Devcon1..Devcon100 with password "devcon".
 * Gated by env var SEED_TEST_USERS=1. Idempotent (skips existing usernames).
 *
 * To remove for production:
 *   1. Delete this directory: Codebase/Backend/src/db/_testSeed/
 *   2. Remove the require + call in src/db/initDb.js (search for "TEST SEED")
 */
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const TEST_USER_COUNT = 100;
const TEST_USERNAME_PREFIX = 'Devcon';
const TEST_PASSWORD = 'devcon';
const TEST_EMAIL_DOMAIN = 'test.local';

function ensureTestFolders() {
  if (process.env.SEED_TEST_USERS !== '1') return;
  const testRoot = process.env.TEST_RESULTS_DIR
    || path.join(__dirname, '..', '..', '..', '..', '..', 'test');
  if (!fs.existsSync(testRoot)) fs.mkdirSync(testRoot, { recursive: true });
  let created = 0;
  for (let i = 1; i <= TEST_USER_COUNT; i += 1) {
    const dir = path.join(testRoot, `${TEST_USERNAME_PREFIX.toLowerCase()}${i}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created += 1;
    }
  }
  if (created > 0) console.log(`[seed] Created ${created} missing devcon folder(s) under ${testRoot}.`);
}

function listTestAccounts() {
  if (process.env.SEED_TEST_USERS !== '1') return [];
  return Array.from({ length: TEST_USER_COUNT }, (_, i) => `${TEST_USERNAME_PREFIX}${i + 1}`);
}

function seedDevconUsers(db) {
  if (process.env.SEED_TEST_USERS !== '1') return;

  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO users (username, email, password_hash, created_at)
     VALUES (?, ?, ?, datetime('now'))`
  );

  let inserted = 0;
  const txn = db.transaction(() => {
    for (let i = 1; i <= TEST_USER_COUNT; i += 1) {
      const username = `${TEST_USERNAME_PREFIX}${i}`;
      const email = `${username.toLowerCase()}@${TEST_EMAIL_DOMAIN}`;
      const result = insert.run(username, email, hash);
      if (result.changes > 0) inserted += 1;
    }
  });
  txn();

  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} Devcon test user(s).`);
  }
}

module.exports = { seedDevconUsers, ensureTestFolders, listTestAccounts };
