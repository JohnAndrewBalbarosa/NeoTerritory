import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  register, login, claimSeat, heartbeat, disconnect, startTesterSeatSweep
} from '../controllers/authController';
import { validateBody } from '../middleware/validateBody';
import { loginSchema, claimSeatSchema } from '../validation/schemas';
import { jwtAuth } from '../middleware/jwtAuth';
import { revokeToken } from '../middleware/tokenRevocation';
import db from '../db/database';
// TEST SEED — REMOVE FOR PRODUCTION
import { listTestAccounts } from '../db/_testSeed/devconUsers';

const DEVCON_RE = /^devcon\d+$/i;

const router = express.Router();

router.post('/register', register);
router.post('/login', validateBody(loginSchema), login);
// TEST SEED — REMOVE FOR PRODUCTION
router.post('/claim', validateBody(claimSeatSchema), claimSeat);

// Heartbeat: keeps the tester seat allocated while the browser tab is alive.
// jwtAuth already touches last_active on every authed request, but we expose
// a dedicated endpoint so an idle (no-API-activity) tab still beats.
router.post('/heartbeat', jwtAuth, heartbeat);

// Explicit release on tab close (sent via navigator.sendBeacon on pagehide).
router.post('/disconnect', jwtAuth, disconnect);

// Beacon-friendly variant: navigator.sendBeacon cannot set an Authorization
// header, so we accept the JWT in the body. Verifies token inline and frees
// the seat. No response is read by the browser (the page is unloading).
router.post('/disconnect-beacon', express.json({ type: '*/*', limit: '4kb' }), (req: Request, res: Response) => {
  const token = (req.body && (req.body as { token?: string }).token) || '';
  if (!token) {
    res.status(400).json({ error: 'token required' });
    return;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: number; username?: string;
    };
    if (decoded?.username && DEVCON_RE.test(decoded.username)) {
      db.prepare("UPDATE users SET claimed_at = NULL WHERE id = ? AND username LIKE 'Devcon%'").run(decoded.id);
    }
    db.prepare("UPDATE users SET last_active = datetime('now', '-1 hour') WHERE id = ?").run(decoded.id);
    // Revoke the token so a tab-close-then-paste-token attack can't reuse it.
    revokeToken(token);
    res.status(204).end();
  } catch {
    res.status(401).end();
  }
});

// Start the missed-heartbeat sweep on module load. unref()'d, single instance.
startTesterSeatSweep();

interface DevconRow {
  username: string;
  claimed_at: string | null;
}

interface TesterAccount {
  username: string;
  claimed: boolean;
}

// TEST SEED — REMOVE FOR PRODUCTION
// Tester picker: returns each devcon seat with its claim state. Falls back to
// the legacy listTestAccounts() shape (string[]) when the DB hasn't been
// migrated yet (no claimed_at column) so the picker still renders.
function loadTesterAccounts(): TesterAccount[] {
  try {
    const rows = db
      .prepare(`SELECT username, claimed_at FROM users WHERE username LIKE 'Devcon%' ORDER BY id ASC`)
      .all() as DevconRow[];
    return rows
      .filter((r) => /^devcon\d+$/i.test(r.username))
      .map((r) => ({ username: r.username, claimed: r.claimed_at != null }));
  } catch {
    // Pre-migration fallback via the legacy seed helper.
    const fallback = listTestAccounts() as unknown;
    if (Array.isArray(fallback)) {
      return fallback.map((a) =>
        typeof a === 'string'
          ? { username: a, claimed: false }
          : (a as TesterAccount)
      );
    }
    return [];
  }
}

router.get('/test-accounts', (_req: Request, res: Response) => {
  const accounts = loadTesterAccounts();
  res.json({ accounts, password: accounts.length ? 'devcon' : null });
});

export default router;
