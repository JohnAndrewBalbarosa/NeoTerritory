import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { logEvent } from '../services/logService';
import { revokeToken } from '../middleware/tokenRevocation';
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
  // The seat is freely claimable when:
  //  • nobody holds it (claimed_at IS NULL), OR
  //  • the last claim is older than 4 hours (hard ceiling — handles
  //    abandoned sessions where the tab simply never closed cleanly), OR
  //  • the previous claimant has gone offline by heartbeat (last_active is
  //    older than the online window). This is the "is the user really
  //    sitting at the seat right now" check the frontend is asking for —
  //    we don't want to reject a fresh sign-in because someone tabbed away
  //    two hours ago without signing out.
  const update = db
    .prepare(
      `UPDATE users SET claimed_at = datetime('now')
       WHERE username = ?
         AND (claimed_at IS NULL
              OR claimed_at < datetime('now', '-4 hours')
              OR last_active IS NULL
              OR last_active < datetime('now', '-2 minutes'))`
    )
    .run(username);
  if (update.changes > 0) return { ok: true };
  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: number } | undefined;
  if (!existing) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'already_claimed' };
}

// Tester seat is freed if no heartbeat lands within this many seconds. Picked
// large enough to survive a brief network blip (frontend beats every 30s) but
// small enough that closing a tab returns the seat within ~2 minutes.
export const HEARTBEAT_GRACE_SECONDS = 90;

// Heartbeat endpoint. Browsers POST here every ~30s while the tab lives. We
// just touch last_active; the absence of beats is what frees a seat.
export const heartbeat = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(req.user.id);
  } catch {
    // last_active column may be missing on old DBs; non-fatal.
  }
  res.json({ ok: true });
};

// Explicit disconnect. Frees the tester seat AND revokes the JWT so the same
// token cannot be reused after sign-out. The frontend hits this on the
// sign-out flow (and also on pagehide via the beacon variant below) so a tab
// close or a deliberate sign-out both release the seat instantly without
// waiting for the heartbeat sweep.
export const disconnect = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    if (DEVCON_USERNAME_RE.test(req.user.username || '')) {
      db.prepare("UPDATE users SET claimed_at = NULL WHERE id = ? AND username LIKE 'Devcon%'").run(req.user.id);
    }
    db.prepare("UPDATE users SET last_active = datetime('now', '-1 hour') WHERE id = ?").run(req.user.id);
  } catch {
    // Non-fatal — sweep will reconcile.
  }
  // Revoke the token used to authenticate this request. Subsequent requests
  // carrying it will be rejected by jwtAuth with 401 before verification.
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    revokeToken(auth.split(' ')[1]);
  }
  res.json({ ok: true });
};

// Periodic sweep: any tester whose claimed seat hasn't heartbeat'd within the
// grace window has its seat freed. Runs on a single interval per process.
let sweepStarted = false;
export function startTesterSeatSweep(): void {
  if (sweepStarted) return;
  sweepStarted = true;
  setInterval(() => {
    try {
      db.prepare(
        `UPDATE users SET claimed_at = NULL
         WHERE username LIKE 'Devcon%'
           AND claimed_at IS NOT NULL
           AND (last_active IS NULL
                OR strftime('%s','now') - strftime('%s', last_active) >= ?)`
      ).run(HEARTBEAT_GRACE_SECONDS);
    } catch {
      // Pre-migration DBs simply skip; the column will appear on next start.
    }
  }, 30 * 1000).unref();
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
