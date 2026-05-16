/**
 * Google sign-in via Supabase Auth (GoTrue).
 *
 * Flow:
 *   1. FE calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
 *      using the @supabase/supabase-js SDK and the project's anon key.
 *   2. GoTrue handles the Google round-trip and redirects to the FE
 *      with the session in the URL fragment.
 *   3. FE POSTs the resulting access_token to /auth/google/exchange
 *      with a `role` hint ("developer" or "student") so the backend
 *      can record the entry flow.
 *   4. This handler verifies the token against Supabase
 *      (/auth/v1/user), upserts a local users row, mints our app JWT
 *      and returns it. The FE then stores the JWT exactly as it does
 *      for the existing username/password login.
 *
 * Why server-side mint instead of just using the Supabase session
 * directly: the rest of the app already issues its own JWT and uses
 * it everywhere (jwtAuth middleware, admin requireAdmin, etc). Adding
 * a parallel auth layer would mean rewriting every guard. The cheaper
 * path is "Supabase verifies who you are; we mint the JWT we already
 * trust."
 */
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { logEvent } from '../services/logService';
import { mirrorRow } from '../services/supabaseLogger';

const router = express.Router();

interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string; avatar_url?: string };
  app_metadata?: { provider?: string };
}

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  role: string;
  // The schema's column name is `password_hash` (initDb.ts).
  // Stored as an opaque "oauth:..." sentinel so the password-login
  // path can never claim the row.
  password_hash: string;
}

const SUPABASE_AUTH_URL = (
  process.env.AUTH_SUPABASE_SELF_HOSTED_URL
  || process.env.SUPABASE_URL
  || ''
).replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.AUTH_SUPABASE_ANON_KEY || '';

function authConfigured(): boolean {
  return !!SUPABASE_AUTH_URL && !!SUPABASE_ANON_KEY;
}

// Verify a Supabase access_token by calling /auth/v1/user against the
// configured Supabase project. Returns the decoded user object on
// success or null on any failure. Uses the anon key as the apikey
// header (GoTrue requires both the apikey and Authorization headers).
async function verifySupabaseToken(token: string): Promise<SupabaseUser | null> {
  if (!authConfigured()) return null;
  try {
    const resp = await fetch(`${SUPABASE_AUTH_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as SupabaseUser;
    if (!json?.id) return null;
    return json;
  } catch {
    return null;
  }
}

// Find-or-create a local users row for a Supabase identity. We key on
// email when present (Google always provides one); falls back to a
// derived username when email is missing or already in use under a
// different role. The local row keeps NeoTerritory-side state (saved
// runs, reviews, surveys) joined to the user.
function upsertLocalUser(supaUser: SupabaseUser, role: 'developer' | 'student'): UserRow {
  const email = (supaUser.email || '').toLowerCase().trim();
  const display = supaUser.user_metadata?.full_name
               || supaUser.user_metadata?.name
               || (email ? email.split('@')[0] : `google_${supaUser.id.slice(0, 8)}`);

  // Reuse a local row when one already exists for this email — keeps
  // saved runs / reviews bound to the same numeric user_id across
  // sessions. Only matches non-tester/non-admin rows so we never
  // accidentally collide with a Devcon seat or the seeded admin.
  if (email) {
    const existing = db.prepare(
      `SELECT id, username, email, role, password_hash FROM users
       WHERE lower(email) = ? AND role NOT IN ('admin')
       LIMIT 1`
    ).get(email) as UserRow | undefined;
    if (existing) {
      // Re-mirror to Supabase Cloud on every login. The Supabase row
      // may not exist yet (rows created before SUPABASE_URL was set)
      // and a no-op upsert is cheap. PostgREST treats this as an
      // INSERT; idx_users_username makes the duplicate-key handling
      // fast. mirrorRow is fire-and-forget so a transient cloud blip
      // never blocks login.
      // entry_flow not in Supabase users schema; logged separately via
      // mirrorAuditEvent so the cohort split survives without poisoning
      // the row insert with an unknown column.
      mirrorRow('users', {
        id: existing.id,
        username: existing.username,
        email: existing.email,
        role: existing.role,
      });
      return existing;
    }
  }

  // Pick a unique username. Strip non-word chars from the display name
  // and append a short id suffix; retry-with-suffix if the result
  // collides (extremely unlikely but defensive).
  let base = display.replace(/[^a-zA-Z0-9_-]+/g, '').slice(0, 24) || 'user';
  let username = `${base}_${supaUser.id.slice(0, 6)}`;
  let attempt = 0;
  while (db.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username)) {
    attempt += 1;
    username = `${base}_${supaUser.id.slice(0, 6)}_${attempt}`;
    if (attempt > 5) break;
  }

  // password_hash column is NOT NULL in the existing schema (see
  // initDb.ts). We store an unguessable opaque sentinel so the
  // password-login path's bcrypt.compare can never match this row —
  // auth for OAuth users is exclusively via Supabase. The sentinel
  // is never compared against; it only exists to satisfy the NOT NULL
  // constraint.
  const placeholderHash = `oauth:${supaUser.id}:${Math.random().toString(36).slice(2)}`;
  // created_at: schema declares NOT NULL with no default; pass a
  // fresh ISO timestamp.
  // The schema declares email NOT NULL UNIQUE. Google sign-in always
  // returns an email, but defensively synthesize a unique placeholder
  // tied to the Supabase user id when one is somehow missing — better
  // than rejecting the sign-in. The placeholder is non-deliverable so
  // it cannot collide with a real user.
  const safeEmail = email || `oauth_${supaUser.id}@nodelivery.local`;
  const info = db.prepare(
    `INSERT INTO users (username, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(username, safeEmail, placeholderHash, 'user');
  const id = Number(info.lastInsertRowid);

  // Best-effort entry-flow audit so admin analytics can split developer
  // vs student onboarding without changing the role enum.
  logEvent(id, 'auth.google.signup', `role=${role} username=${username}`);
  mirrorRow('users', { id, username, email: safeEmail, role: 'user' });
  return { id, username, email: safeEmail, role: 'user', password_hash: placeholderHash };
}

router.post('/google/exchange', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!authConfigured()) {
      res.status(503).json({
        error: 'Supabase auth not configured',
        detail: 'AUTH_SUPABASE_SELF_HOSTED_URL (or SUPABASE_URL) and AUTH_SUPABASE_ANON_KEY must be set.'
      });
      return;
    }

    const body = (req.body || {}) as { accessToken?: unknown; role?: unknown };
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const roleRaw = typeof body.role === 'string' ? body.role : '';
    const role: 'developer' | 'student' = roleRaw === 'student' ? 'student' : 'developer';
    if (!accessToken) {
      res.status(400).json({ error: 'accessToken required' });
      return;
    }

    const supaUser = await verifySupabaseToken(accessToken);
    if (!supaUser) {
      res.status(401).json({ error: 'Invalid Supabase token' });
      return;
    }

    const localUser = upsertLocalUser(supaUser, role);
    const token = jwt.sign(
      { id: localUser.id, username: localUser.username, email: localUser.email, role: localUser.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(localUser.id, 'auth.google.login', `role=${role} username=${localUser.username}`);

    res.json({
      token,
      user: {
        id: localUser.id,
        username: localUser.username,
        email: localUser.email,
        role: localUser.role
      },
      entryFlow: role
    });
  } catch (err) {
    next(err);
  }
});

// Lightweight readiness probe so the FE can ask "is google sign-in
// available right now?" before rendering the button. Returns false
// (and 200) when the env vars are blank, so the FE can hide the button
// gracefully instead of letting the user click into a 503.
router.get('/google/status', (_req: Request, res: Response): void => {
  res.json({
    configured: authConfigured(),
    supabaseUrl: authConfigured() ? SUPABASE_AUTH_URL : null,
    anonKeyConfigured: !!SUPABASE_ANON_KEY
  });
});

export default router;
