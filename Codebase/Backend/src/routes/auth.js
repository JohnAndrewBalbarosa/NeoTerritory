const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db/database');
const { register, login } = require('../controllers/authController');
const { jwtAuth } = require('../middleware/jwtAuth');
// TEST SEED - REMOVE FOR PRODUCTION
const {
  KEY_ALGORITHM,
  fingerprintPrivateKey,
  generateSeatKeypair,
  isDevconUsername,
  listTestAccounts
} = require('../db/_testSeed/devconUsers');

const SEAT_TTL_MS = 60 * 1000;
const HEARTBEAT_INTERVAL_SECONDS = 30;

router.post('/register', register);
router.post('/login', login);

function nowIso() {
  return new Date().toISOString();
}

function expiryIso() {
  return new Date(Date.now() + SEAT_TTL_MS).toISOString();
}

function publicUser(user, extras = {}) {
  const role = user.role || 'user';
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role,
    publicKeyFingerprint: user.public_key_fingerprint || null,
    keyAlgorithm: user.key_algorithm || KEY_ALGORITHM,
    seatStatus: user.seat_status || 'available',
    seatClaimedAt: user.seat_claimed_at || null,
    seatExpiresAt: user.seat_expires_at || null,
    lastHeartbeatAt: user.last_heartbeat_at || null,
    ...extras
  };
}

function clearSeatById(id) {
  return db.prepare(`
    UPDATE users
    SET public_key_pem = NULL,
        private_key_pem = NULL,
        public_key_fingerprint = NULL,
        key_algorithm = ?,
        seat_status = 'available',
        seat_claimed_at = NULL,
        seat_claim_token = NULL,
        seat_expires_at = NULL,
        last_heartbeat_at = NULL
    WHERE id = ?
  `).run(KEY_ALGORITHM, id);
}

function cleanupExpiredSeats() {
  const now = nowIso();
  const expired = db.prepare(`
    SELECT id
    FROM users
    WHERE username LIKE 'Devcon%'
      AND (
        (seat_status = 'occupied' AND (seat_expires_at IS NULL OR seat_expires_at <= ?))
        OR (COALESCE(seat_status, 'available') != 'occupied'
            AND (public_key_pem IS NOT NULL
              OR private_key_pem IS NOT NULL
              OR public_key_fingerprint IS NOT NULL
              OR seat_claim_token IS NOT NULL
              OR seat_expires_at IS NOT NULL
              OR last_heartbeat_at IS NOT NULL))
      )
  `).all(now);

  const txn = db.transaction(() => {
    expired.forEach(row => clearSeatById(row.id));
  });
  txn();
  return expired.length;
}

function signSeatJwt(user) {
  const role = user.role || 'user';
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function getDevconSeat(username) {
  return db.prepare(`
    SELECT id, username, email, role, public_key_pem, private_key_pem,
           public_key_fingerprint, key_algorithm, seat_status, seat_claimed_at,
           seat_claim_token, seat_expires_at, last_heartbeat_at
    FROM users
    WHERE username = ?
  `).get(username);
}

function getFirstAvailableSeat() {
  return db.prepare(`
    SELECT id, username, email, role, public_key_pem, private_key_pem,
           public_key_fingerprint, key_algorithm, seat_status, seat_claimed_at,
           seat_claim_token, seat_expires_at, last_heartbeat_at
    FROM users
    WHERE username LIKE 'Devcon%'
      AND COALESCE(seat_status, 'available') != 'occupied'
    ORDER BY CAST(SUBSTR(username, 7) AS INTEGER)
    LIMIT 1
  `).get();
}

function assertSeatAccess(req, res) {
  const privateKey = req.body && req.body.privateKey;
  const claimToken = req.body && req.body.claimToken;
  if (!privateKey || typeof privateKey !== 'string') {
    res.status(400).json({ error: 'privateKey required' });
    return null;
  }
  if (!claimToken || typeof claimToken !== 'string') {
    res.status(400).json({ error: 'claimToken required' });
    return null;
  }
  if (!req.user || !isDevconUsername(req.user.username)) {
    res.status(403).json({ error: 'Endpoint is for Devcon test seats only' });
    return null;
  }

  cleanupExpiredSeats();
  const seat = getDevconSeat(req.user.username);
  if (!seat || seat.seat_status !== 'occupied') {
    res.status(401).json({ error: 'Seat is not occupied or already expired' });
    return null;
  }
  if (seat.seat_claim_token !== claimToken) {
    res.status(401).json({ error: 'Invalid seat claim token' });
    return null;
  }
  if (!seat.seat_expires_at || seat.seat_expires_at <= nowIso()) {
    clearSeatById(seat.id);
    res.status(401).json({ error: 'Seat session expired' });
    return null;
  }

  let fingerprint;
  try {
    fingerprint = fingerprintPrivateKey(privateKey);
  } catch (err) {
    res.status(400).json({ error: `Invalid private key: ${err.message}` });
    return null;
  }
  if (fingerprint !== seat.public_key_fingerprint) {
    res.status(401).json({ error: 'Private key does not match this Devcon seat' });
    return null;
  }
  return seat;
}

// TEST SEED - REMOVE FOR PRODUCTION
router.get('/test-accounts', (req, res, next) => {
  try {
    cleanupExpiredSeats();
    const accounts = listTestAccounts();
    const seatRows = db.prepare(`
      SELECT id, username, email, public_key_fingerprint, key_algorithm,
             seat_status, seat_claimed_at, seat_expires_at, last_heartbeat_at
      FROM users
      WHERE username LIKE 'Devcon%'
      ORDER BY CAST(SUBSTR(username, 7) AS INTEGER)
    `).all();
    const seatByUsername = new Map(seatRows.map(row => [row.username, row]));
    const testers = accounts.map(username => {
      const seat = seatByUsername.get(username);
      return seat
        ? publicUser(seat, { available: seat.seat_status !== 'occupied' })
        : { username, seatStatus: 'available', available: true };
    });
    res.json({
      accounts,
      testers,
      seatTtlSeconds: SEAT_TTL_MS / 1000,
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS
    });
  } catch (err) {
    next(err);
  }
});

router.post('/test-seat/claim', (req, res, next) => {
  try {
    cleanupExpiredSeats();
    const requestedUsername = req.body && typeof req.body.username === 'string'
      ? req.body.username.trim()
      : '';

    let seat;
    if (requestedUsername) {
      if (!isDevconUsername(requestedUsername)) {
        return res.status(400).json({ error: 'username must be Devcon1..Devcon100' });
      }
      seat = getDevconSeat(requestedUsername);
      if (!seat) return res.status(404).json({ error: 'Devcon seat not found' });
      if (seat.seat_status === 'occupied') {
        return res.status(409).json({
          error: 'Seat already occupied',
          user: publicUser(seat)
        });
      }
    } else {
      seat = getFirstAvailableSeat();
      if (!seat) return res.status(409).json({ error: 'No Devcon seats available' });
    }

    const keypair = generateSeatKeypair();
    const claimToken = crypto.randomBytes(32).toString('hex');
    const claimedAt = nowIso();
    const expiresAt = expiryIso();
    const updated = db.prepare(`
      UPDATE users
      SET public_key_pem = ?,
          private_key_pem = NULL,
          public_key_fingerprint = ?,
          key_algorithm = ?,
          seat_status = 'occupied',
          seat_claimed_at = ?,
          seat_claim_token = ?,
          seat_expires_at = ?,
          last_heartbeat_at = ?
      WHERE id = ? AND COALESCE(seat_status, 'available') != 'occupied'
    `).run(
      keypair.publicKeyPem,
      keypair.publicKeyFingerprint,
      KEY_ALGORITHM,
      claimedAt,
      claimToken,
      expiresAt,
      claimedAt,
      seat.id
    );

    if (updated.changes !== 1) {
      return res.status(409).json({ error: 'Seat already occupied' });
    }

    const claimed = getDevconSeat(seat.username);
    res.json({
      claimed: true,
      token: signSeatJwt(claimed),
      user: publicUser(claimed),
      publicKey: keypair.publicKeyPem,
      privateKey: keypair.privateKeyPem,
      publicKeyFingerprint: keypair.publicKeyFingerprint,
      claimToken,
      expiresInSeconds: SEAT_TTL_MS / 1000,
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS
    });
  } catch (err) {
    next(err);
  }
});

router.post('/test-seat/heartbeat', jwtAuth, (req, res) => {
  const seat = assertSeatAccess(req, res);
  if (!seat) return;

  const heartbeatAt = nowIso();
  const expiresAt = expiryIso();
  db.prepare(`
    UPDATE users
    SET last_heartbeat_at = ?,
        seat_expires_at = ?
    WHERE id = ?
  `).run(heartbeatAt, expiresAt, seat.id);

  res.json({
    ok: true,
    user: publicUser({ ...seat, last_heartbeat_at: heartbeatAt, seat_expires_at: expiresAt }),
    expiresAt,
    expiresInSeconds: SEAT_TTL_MS / 1000,
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS
  });
});

router.post('/test-seat/release', jwtAuth, (req, res) => {
  if (!req.user || !isDevconUsername(req.user.username)) {
    return res.json({ released: false, reason: 'not-devcon-seat' });
  }
  const seat = getDevconSeat(req.user.username);
  if (seat) clearSeatById(seat.id);
  res.json({ released: true, username: req.user.username });
});

module.exports = router;
