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
import {
  isOriginalDevEmail,
  NEOTERRITORY_ORG_ID,
} from '../config/originalDevs';

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
type SignInRole = 'developer' | 'student' | 'admin';

// Ensures an org_memberships row exists tying this local user to the
// given org id with the given role. Idempotent — re-running on every
// login is safe and lets us patch supabase_user_id once it's known.
function ensureMembership(
  orgId: string,
  email: string,
  supabaseUserId: string,
  role: 'admin' | 'developer',
): void {
  // The SQLite mirror table for memberships lives next to
  // org_pattern_catalogs. Create-if-missing so dev environments that
  // never ran the Supabase migrations still work; production reads
  // from the Supabase tables via the supabase logger.
  db.prepare(`CREATE TABLE IF NOT EXISTS org_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    supabase_user_id TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, email)
  )`).run();
  const lowered = email.toLowerCase();
  const existing = db.prepare(
    `SELECT id, supabase_user_id FROM org_memberships WHERE org_id = ? AND email = ?`
  ).get(orgId, lowered) as { id: number; supabase_user_id: string | null } | undefined;
  if (existing) {
    if (!existing.supabase_user_id && supabaseUserId) {
      db.prepare(`UPDATE org_memberships SET supabase_user_id = ? WHERE id = ?`)
        .run(supabaseUserId, existing.id);
    }
    return;
  }
  db.prepare(
    `INSERT INTO org_memberships (org_id, supabase_user_id, email, role) VALUES (?, ?, ?, ?)`
  ).run(orgId, supabaseUserId || null, lowered, role);
  // Mirror to Supabase Cloud best-effort.
  mirrorRow('org_memberships', { org_id: orgId, email: lowered, role });
}

// For a brand-new self-serve admin (Google sign-in, NOT in
// ORIGINAL_DEV_EMAILS, no existing membership), spin up a new
// organization owned by them. The org slug is derived from their
// email local-part with a short uid suffix to dodge collisions; the
// row is added to a local SQLite mirror and best-effort mirrored to
// the Supabase organizations table.
function createSelfServeOrg(email: string, displayName: string): string {
  db.prepare(`CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    is_original_devs INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  const local = (email.split('@')[0] || displayName || 'org')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'org';
  let slug = local;
  let suffix = 0;
  while (db.prepare(`SELECT 1 FROM organizations WHERE slug = ?`).get(slug)) {
    suffix += 1;
    slug = `${local}-${suffix}`;
    if (suffix > 50) {
      slug = `${local}-${Math.random().toString(36).slice(2, 6)}`;
      break;
    }
  }
  // Use a deterministic-looking uuid-ish id so the row id is stable
  // even before the Supabase mirror runs.
  const id = `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const name = displayName ? `${displayName}'s org` : slug;
  db.prepare(
    `INSERT INTO organizations (id, name, slug, is_original_devs) VALUES (?, ?, ?, 0)`
  ).run(id, name, slug);
  mirrorRow('organizations', { id, name, slug, is_original_devs: false });
  return id;
}

function upsertLocalUser(supaUser: SupabaseUser, role: SignInRole): UserRow {
  const email = (supaUser.email || '').toLowerCase().trim();
  const display = supaUser.user_metadata?.full_name
               || supaUser.user_metadata?.name
               || (email ? email.split('@')[0] : `google_${supaUser.id.slice(0, 8)}`);

  // Reuse a local row when one already exists for this email — keeps
  // saved runs / reviews bound to the same numeric user_id across
  // sessions. Original-devs (Andrew/Miryl/Josephine) reuse their row
  // even if it was seeded as admin. Other roles match non-admin rows
  // only so we never accidentally collide with a Devcon seat or the
  // seeded legacy admin.
  if (email) {
    const matchClause = role === 'admin' && isOriginalDevEmail(email)
      ? `WHERE lower(email) = ? LIMIT 1`
      : `WHERE lower(email) = ? AND role NOT IN ('admin') LIMIT 1`;
    const existing = db.prepare(
      `SELECT id, username, email, role, password_hash FROM users ${matchClause}`
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
  // Admin intent + email in the original-devs allowlist creates an
  // 'admin' local row. Any other Google sign-in stays 'user'; admin
  // privileges for self-serve admins are conferred via the
  // org_memberships row (role='admin' for their own org) not via the
  // users.role column, so the legacy requireAdmin gate only opens for
  // the seeded NeoTerritory admins.
  const localRole = role === 'admin' && isOriginalDevEmail(safeEmail) ? 'admin' : 'user';
  const info = db.prepare(
    `INSERT INTO users (username, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(username, safeEmail, placeholderHash, localRole);
  const id = Number(info.lastInsertRowid);

  // Best-effort entry-flow audit so admin analytics can split developer
  // vs student onboarding without changing the role enum.
  logEvent(id, 'auth.google.signup', `role=${role} localRole=${localRole} username=${username}`);
  mirrorRow('users', { id, username, email: safeEmail, role: localRole });
  return { id, username, email: safeEmail, role: localRole, password_hash: placeholderHash };
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
    let role: SignInRole;
    if (roleRaw === 'student') role = 'student';
    else if (roleRaw === 'admin' || roleRaw === 'pm') role = 'admin';
    else role = 'developer';
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

    // Org binding: only resolved for admin sign-ins.
    //   - Original-dev emails → seeded NeoTerritory org as admin.
    //   - Any other admin sign-in → self-serve: create a new org owned
    //     by this email, attach an admin membership.
    //   - Developer sign-ins stay membership-less here; they're
    //     expected to redeem an invite after first sign-in.
    let orgId: string | null = null;
    let isOriginalDevs = false;
    let createdNewOrg = false;
    if (role === 'admin') {
      const email = (localUser.email || '').toLowerCase();
      if (isOriginalDevEmail(email)) {
        orgId = NEOTERRITORY_ORG_ID;
        isOriginalDevs = true;
        ensureMembership(orgId, email, supaUser.id, 'admin');
      } else if (email) {
        // Look for an existing self-serve org for this email first.
        db.prepare(`CREATE TABLE IF NOT EXISTS org_memberships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          org_id TEXT NOT NULL,
          supabase_user_id TEXT,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          joined_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(org_id, email)
        )`).run();
        const existing = db.prepare(
          `SELECT org_id FROM org_memberships WHERE email = ? AND role = 'admin' LIMIT 1`
        ).get(email) as { org_id: string } | undefined;
        if (existing) {
          orgId = existing.org_id;
        } else {
          orgId = createSelfServeOrg(email, localUser.username || '');
          createdNewOrg = true;
        }
        ensureMembership(orgId, email, supaUser.id, 'admin');
      }
    }

    const token = jwt.sign(
      {
        id: localUser.id,
        username: localUser.username,
        email: localUser.email,
        role: localUser.role,
        orgId,
        isOriginalDevs,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(
      localUser.id,
      'auth.google.login',
      `role=${role} username=${localUser.username} orgId=${orgId ?? '-'} newOrg=${createdNewOrg}`
    );

    res.json({
      token,
      user: {
        id: localUser.id,
        username: localUser.username,
        email: localUser.email,
        role: localUser.role,
        orgId,
        isOriginalDevs,
      },
      entryFlow: role,
      orgCreated: createdNewOrg
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
