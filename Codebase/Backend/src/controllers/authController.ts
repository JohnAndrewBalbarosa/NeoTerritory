import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { logEvent } from '../services/logService';
import type { UserRow } from '../types/db';

const DEVCON_USERNAME_RE = /^devcon\d+$/i;

// Idempotent migration: tester seats need a claimed_at column. Runs once at
// module load. If db/initDb.ts already adds the column, this is a no-op.
function ensureClaimedAtColumn(): void {
  try {
    const rows = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
    if (!rows.some((r) => r.name === 'claimed_at')) {
      db.prepare(`ALTER TABLE users ADD COLUMN claimed_at TEXT`).run();
    }
  } catch {
    // Users table may not exist yet at import time; initDb will create it
    // and the next login/claim path falls back gracefully.
  }
}
ensureClaimedAtColumn();

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
    if (!username || !email || !password) {
      res.status(400).json({ error: 'All fields required' });
      return;
    }
    const userExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (userExists) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, 'user', datetime('now'))");
    const info = stmt.run(username, email, hash);
    logEvent(Number(info.lastInsertRowid), 'register', `User registered: ${email}`);
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, username, password } = req.body as { email?: string; username?: string; password?: string };
    const identifier = (username || email || '').trim();
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username (or email) and password required' });
      return;
    }
    const user = db
      .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
      .get(identifier, identifier) as UserRow | undefined;
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (DEVCON_USERNAME_RE.test(user.username) && (user as { claimed_at?: string | null }).claimed_at == null) {
      res.status(403).json({ error: 'Tester seat must be claimed via picker' });
      return;
    }
    const role = user.role || 'user';
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(user.id, 'login', `User logged in: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role } });
  } catch (err) {
    next(err);
  }
};


interface ClaimResult {
  ok: boolean;
  reason?: 'not_found' | 'already_claimed';
}

function claimSeatTransaction(username: string): ClaimResult {
  // Allow claiming if: seat is unclaimed OR previous claim is older than 4 hours (stale session).
  const update = db
    .prepare(`UPDATE users SET claimed_at = datetime('now') WHERE username = ? AND (claimed_at IS NULL OR claimed_at < datetime('now', '-4 hours'))`)
    .run(username);
  if (update.changes > 0) return { ok: true };
  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: number } | undefined;
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'already_claimed' };
}

export const claimSeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username } = req.body as { username?: string };
    const candidate = (username || '').trim();
    if (!DEVCON_USERNAME_RE.test(candidate)) {
      res.status(400).json({ error: 'Invalid tester username' });
      return;
    }
    const result = claimSeatTransaction(candidate);
    if (!result.ok) {
      if (result.reason === 'not_found') {
        res.status(404).json({ error: 'Tester seat not found' });
        return;
      }
      if (result.reason === 'already_claimed') {
        res.status(409).json({ error: 'Tester seat already claimed' });
        return;
      }
      res.status(400).json({ error: 'Could not claim seat' });
      return;
    }
    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(candidate) as UserRow | undefined;
    if (!user) {
      res.status(404).json({ error: 'Tester seat not found' });
      return;
    }
    const role = user.role || 'user';
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(user.id, 'claim_seat', `Tester seat claimed: ${user.username}`);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, role } });
  } catch (err) {
    next(err);
  }
};
