import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  register, login, claimSeat, heartbeat, disconnect, startTesterSeatSweep
} from '../controllers/authController';
import { validateBody } from '../middleware/validateBody';
import { loginSchema, claimSeatSchema } from '../validation/schemas';
import { jwtAuth } from '../middleware/jwtAuth';
import { registerSession, dropSession } from '../middleware/sealedEnvelope';
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
    // Intentionally NOT revoking the token here: pagehide fires on every full-page
    // navigation (including window.location.href = '/admin'), so revoking the JWT
    // would brick the very next page load. Token revocation happens on explicit
    // sign-out via /auth/disconnect, which is the only path that should kill the JWT.
    res.status(204).end();
  } catch {
    res.status(401).end();
  }
});

// Start the missed-heartbeat sweep on module load. unref()'d, single instance.
startTesterSeatSweep();

// Stateless asymmetric session bootstrap. Client posts its ECDSA public key
// at /auth/session-init; subsequent requests to /api/sealed/* sign their
// envelopes with the matching private key. See docs/SECURITY.md §8.
router.post('/session-init', jwtAuth, (req: Request, res: Response) => {
  const { publicKeyPem } = (req.body || {}) as { publicKeyPem?: string };
  if (typeof publicKeyPem !== 'string' || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    res.status(400).json({ error: 'publicKeyPem (PEM-encoded SPKI) required' });
    return;
  }
  // sessionId is the JWT bearer hash so a stolen sessionId cannot be reused
  // without also presenting the original bearer token at session-init.
  const sessionId = require('crypto').createHash('sha256')
    .update((req.headers['authorization'] || '').slice(7))
    .digest('hex');
  registerSession(sessionId, publicKeyPem);
  res.json({ sessionId });
});

router.post('/session-revoke', jwtAuth, (req: Request, res: Response) => {
  const { sessionId } = (req.body || {}) as { sessionId?: string };
  if (typeof sessionId === 'string') dropSession(sessionId);
  res.json({ ok: true });
});

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
