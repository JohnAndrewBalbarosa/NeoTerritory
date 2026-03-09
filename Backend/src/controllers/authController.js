const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { logEvent } = require('../services/logService');

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (userExists) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, datetime("now"))');
    const info = stmt.run(username, email, hash);
    logEvent(info.lastInsertRowid, 'register', `User registered: ${email}`);
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
    logEvent(user.id, 'login', `User logged in: ${email}`);
    res.json({ token });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login };
