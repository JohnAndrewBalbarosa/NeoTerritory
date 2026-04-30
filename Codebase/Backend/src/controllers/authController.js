const bcrypt = require('bcrypt');
const db = require('../db/database');
const { logEvent } = require('../services/logService');
const { signToken } = require('../utils/jwtKeys');
const { claimTestAccount } = require('../db/_testSeed/devconUsers');

const DEVCON_USERNAME_RE = /^devcon\d+$/i;

const register = async (req, res, next) => {
  try {
    // Dual-mode guard: tester mode disables registration. Devcon seats are claimed,
    // not registered. Actual mode keeps registration available for normal users.
    const mode = db.mode || (process.env.NEOTERRITORY_MODE || 'tester').toLowerCase();
    if (mode === 'tester') {
      return res.status(403).json({
        error: 'Registration disabled in tester mode. Use a Devcon seat or admin sign-in.'
      });
    }

    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (userExists) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, \'user\', datetime(\'now\'))');
    const info = stmt.run(username, email, hash);
    logEvent(info.lastInsertRowid, 'register', `User registered: ${email}`);
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (username || email || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username (or email) and password required' });
    }
    const user = db
      .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      .get(identifier, identifier);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (DEVCON_USERNAME_RE.test(user.username) && user.claimed_at == null) {
      return res.status(403).json({ error: 'Tester seat must be claimed via picker' });
    }
    const role = user.role || 'user';
    const token = signToken({ id: user.id, username: user.username, email: user.email, role });
    logEvent(user.id, 'login', `User logged in: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role } });
  } catch (err) {
    next(err);
  }
};

const claimSeat = async (req, res, next) => {
  try {
    const username = (req.body && req.body.username || '').trim();
    if (!DEVCON_USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Invalid tester username' });
    }
    const result = claimTestAccount(username);
    if (!result.ok) {
      if (result.reason === 'not_found') {
        return res.status(404).json({ error: 'Tester seat not found' });
      }
      if (result.reason === 'already_claimed') {
        return res.status(409).json({ error: 'Tester seat already claimed' });
      }
      return res.status(400).json({ error: 'Could not claim seat' });
    }
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username);
    if (!user) {
      return res.status(404).json({ error: 'Tester seat not found' });
    }
    const role = user.role || 'user';
    const token = signToken({ id: user.id, username: user.username, email: user.email, role });
    logEvent(user.id, 'claim_seat', `Tester seat claimed: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role } });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, claimSeat };
