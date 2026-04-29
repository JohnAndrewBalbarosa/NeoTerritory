const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { isDevconUsername } = require('../db/_testSeed/devconUsers');

function clearExpiredDevconSeat(id) {
  db.prepare(`
    UPDATE users
    SET public_key_pem = NULL,
        private_key_pem = NULL,
        public_key_fingerprint = NULL,
        seat_status = 'available',
        seat_claimed_at = NULL,
        seat_claim_token = NULL,
        seat_expires_at = NULL,
        last_heartbeat_at = NULL
    WHERE id = ?
  `).run(id);
}

const jwtAuth = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (isDevconUsername(decoded.username)) {
      const seat = db.prepare(`
        SELECT id, seat_status, seat_expires_at
        FROM users
        WHERE id = ? AND username = ?
      `).get(decoded.id, decoded.username);
      const now = new Date().toISOString();
      if (!seat || seat.seat_status !== 'occupied' || !seat.seat_expires_at) {
        return res.status(401).json({ error: 'Seat session expired' });
      }
      if (seat.seat_expires_at <= now) {
        clearExpiredDevconSeat(seat.id);
        return res.status(401).json({ error: 'Seat session expired' });
      }
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { jwtAuth };
