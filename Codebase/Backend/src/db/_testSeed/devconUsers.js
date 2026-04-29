/*
 * TEST USER SEED - REMOVE FOR PRODUCTION
 * --------------------------------------
 * Seeds 100 Devcon seats: Devcon1..Devcon100.
 * Enabled by default for this testing build. Set SEED_TEST_USERS=0 to disable.
 *
 * Keys are NOT written to the repo. A fresh in-memory/DB-backed keypair is
 * generated only when a browser claims a seat, then cleared after expiry.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TEST_USER_COUNT = 100;
const TEST_USERNAME_PREFIX = 'Devcon';
const TEST_PASSWORD = 'devcon';
const TEST_EMAIL_DOMAIN = 'test.local';
const KEY_ALGORITHM = 'rsa-2048';

function seedEnabled() {
  return process.env.SEED_TEST_USERS !== '0';
}

function getTestRoot() {
  return process.env.TEST_RESULTS_DIR
    || path.join(__dirname, '..', '..', '..', '..', '..', 'test');
}

function devconUsername(index) {
  return `${TEST_USERNAME_PREFIX}${index}`;
}

function isDevconUsername(username) {
  return /^Devcon\d+$/i.test(String(username || ''));
}

function fingerprintPublicKey(publicKeyPem) {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex');
}

function publicKeyFromPrivateKey(privateKeyPem) {
  return crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'pem' });
}

function fingerprintPrivateKey(privateKeyPem) {
  return fingerprintPublicKey(publicKeyFromPrivateKey(privateKeyPem));
}

function generateSeatKeypair() {
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return {
    publicKeyPem: pair.publicKey,
    privateKeyPem: pair.privateKey,
    publicKeyFingerprint: fingerprintPublicKey(pair.publicKey)
  };
}

function ensureTestFolders() {
  if (!seedEnabled()) return;
  const testRoot = getTestRoot();
  if (!fs.existsSync(testRoot)) fs.mkdirSync(testRoot, { recursive: true });
}

function listTestAccounts() {
  if (!seedEnabled()) return [];
  return Array.from({ length: TEST_USER_COUNT }, (_, i) => devconUsername(i + 1));
}

function seedDevconUsers(db) {
  if (!seedEnabled()) return;

  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO users (
       username, email, password_hash, role, key_algorithm,
       seat_status, created_at
     )
     VALUES (?, ?, ?, 'user', ?, 'available', datetime('now'))`
  );
  const normalize = db.prepare(
    `UPDATE users
     SET role = COALESCE(role, 'user'),
         key_algorithm = COALESCE(key_algorithm, ?),
         seat_status = COALESCE(seat_status, 'available')
     WHERE username = ?`
  );

  let inserted = 0;
  const txn = db.transaction(() => {
    for (let i = 1; i <= TEST_USER_COUNT; i += 1) {
      const username = devconUsername(i);
      const email = `${username.toLowerCase()}@${TEST_EMAIL_DOMAIN}`;
      const result = insert.run(username, email, hash, KEY_ALGORITHM);
      if (result.changes > 0) inserted += 1;
      normalize.run(KEY_ALGORITHM, username);
    }
  });
  txn();

  if (inserted > 0) {
    console.log(`[seed] Inserted ${inserted} Devcon test seat(s).`);
  }
}

module.exports = {
  KEY_ALGORITHM,
  TEST_USER_COUNT,
  seedDevconUsers,
  ensureTestFolders,
  listTestAccounts,
  fingerprintPublicKey,
  fingerprintPrivateKey,
  publicKeyFromPrivateKey,
  generateSeatKeypair,
  isDevconUsername,
  seedEnabled
};
