import express, { Request, Response } from 'express';
import { register, login, claimSeat } from '../controllers/authController';
import { validateBody } from '../middleware/validateBody';
import { loginSchema, claimSeatSchema } from '../validation/schemas';
import db from '../db/database';
// TEST SEED — REMOVE FOR PRODUCTION
import { listTestAccounts } from '../db/_testSeed/devconUsers';

const router = express.Router();

router.post('/register', register);
router.post('/login', validateBody(loginSchema), login);
// TEST SEED — REMOVE FOR PRODUCTION
router.post('/claim', validateBody(claimSeatSchema), claimSeat);

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
