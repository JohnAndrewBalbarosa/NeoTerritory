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
// 'unspecified' is for the unified single-button sign-in flow: the
// caller does NOT pre-tag intent, the backend just upserts the user
// and reports whether they are new. The front-end then prompts the
// user once via RoleChooserModal and calls /auth/google/finalize-role
// to commit the chosen role.
type SignInRole = 'developer' | 'student' | 'admin' | 'unspecified';

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

interface UpsertResult {
  row: UserRow;
  wasNew: boolean;
}

function upsertLocalUser(supaUser: SupabaseUser, role: SignInRole): UpsertResult {
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
      mirrorRow('users', {
        id: existing.id,
        username: existing.username,
        email: existing.email,
        role: existing.role,
      });
      return { row: existing, wasNew: false };
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
  return {
    row: { id, username, email: safeEmail, role: localRole, password_hash: placeholderHash },
    wasNew: true,
  };
}

interface OrgBinding {
  orgId: string | null;
  isOriginalDevs: boolean;
  createdNewOrg: boolean;
}

// Resolve the org membership for an admin-intent sign-in. Original-dev
// emails go to the seeded NeoTerritory org; everyone else gets a fresh
// self-serve org owned by them. Idempotent: callers can run this on
// every admin sign-in or once during finalize-role.
function resolveAdminOrg(email: string, displayName: string, supabaseUserId: string): OrgBinding {
  const lowered = email.toLowerCase();
  if (isOriginalDevEmail(lowered)) {
    ensureMembership(NEOTERRITORY_ORG_ID, lowered, supabaseUserId, 'admin');
    return { orgId: NEOTERRITORY_ORG_ID, isOriginalDevs: true, createdNewOrg: false };
  }
  if (!lowered) return { orgId: null, isOriginalDevs: false, createdNewOrg: false };
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
  ).get(lowered) as { org_id: string } | undefined;
  let orgId: string;
  let createdNewOrg = false;
  if (existing) {
    orgId = existing.org_id;
  } else {
    orgId = createSelfServeOrg(lowered, displayName);
    createdNewOrg = true;
  }
  ensureMembership(orgId, lowered, supabaseUserId, 'admin');
  return { orgId, isOriginalDevs: false, createdNewOrg };
}

// Best-effort lookup of an existing membership for this email. Used so
// returning users who originally chose 'developer' don't re-trigger the
// new-user role prompt — their stored role is honored.
function existingMembershipRole(email: string): 'admin' | 'developer' | null {
  if (!email) return null;
  try {
    const row = db.prepare(
      `SELECT role FROM org_memberships WHERE lower(email) = lower(?) ORDER BY role = 'admin' DESC LIMIT 1`
    ).get(email) as { role: string } | undefined;
    if (row?.role === 'admin' || row?.role === 'developer') return row.role;
  } catch {
    // org_memberships table may not exist yet in fresh dev envs.
  }
  return null;
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
    else if (roleRaw === 'unspecified' || roleRaw === '') role = 'unspecified';
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

    const { row: localUser, wasNew } = upsertLocalUser(supaUser, role);

    // Org binding only fires when intent is explicit (admin). For
    // 'unspecified' (the unified single-button flow), we skip org
    // creation entirely; the front-end shows RoleChooserModal on
    // wasNew=true and the user's chosen role is committed via
    // /auth/google/finalize-role. For 'developer' / 'student' we also
    // skip org creation — those flows are membership-less by design
    // until an invite is redeemed.
    const email = (localUser.email || '').toLowerCase();
    let binding: OrgBinding = { orgId: null, isOriginalDevs: false, createdNewOrg: false };
    let promptRoleChoice = false;
    if (role === 'admin') {
      binding = resolveAdminOrg(email, localUser.username || '', supaUser.id);
    } else if (role === 'unspecified') {
      // Returning users with an existing membership keep their prior
      // role and skip the modal. Brand-new users (no membership row)
      // get prompted.
      const priorRole = existingMembershipRole(email);
      if (priorRole === 'admin') {
        binding = resolveAdminOrg(email, localUser.username || '', supaUser.id);
      } else if (priorRole === 'developer') {
        // Membership already exists; no prompt needed.
        promptRoleChoice = false;
      } else {
        // No prior membership. Always prompt for brand-new users; for
        // returning users with a local row but no membership yet, also
        // prompt so they can pick a role even if they've been seen
        // before in the legacy guest flow.
        promptRoleChoice = true;
      }
    }

    const token = jwt.sign(
      {
        id: localUser.id,
        username: localUser.username,
        email: localUser.email,
        role: localUser.role,
        orgId: binding.orgId,
        isOriginalDevs: binding.isOriginalDevs,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );
    logEvent(
      localUser.id,
      'auth.google.login',
      `role=${role} username=${localUser.username} orgId=${binding.orgId ?? '-'} newOrg=${binding.createdNewOrg} wasNew=${wasNew} promptRole=${promptRoleChoice}`
    );

    res.json({
      token,
      user: {
        id: localUser.id,
        username: localUser.username,
        email: localUser.email,
        role: localUser.role,
        orgId: binding.orgId,
        isOriginalDevs: binding.isOriginalDevs,
      },
      entryFlow: role,
      orgCreated: binding.createdNewOrg,
      wasNew,
      promptRoleChoice
    });
  } catch (err) {
    next(err);
  }
});

// Commit a chosen role from the first-time RoleChooserModal. Called
// post-/exchange when the unified single-button sign-in returned
// promptRoleChoice=true. Verifies the bearer JWT (signed by /exchange
// just now), runs the admin org logic if role='admin', and re-mints
// the JWT with the resolved org membership so the front-end can route
// to the right surface.
router.post('/google/finalize-role', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!bearer) {
      res.status(401).json({ error: 'missing bearer token' });
      return;
    }
    let claims: { id?: number; username?: string; email?: string | null; role?: string } = {};
    try {
      claims = jwt.verify(bearer, process.env.JWT_SECRET as string) as typeof claims;
    } catch {
      res.status(401).json({ error: 'invalid bearer token' });
      return;
    }
    const body = (req.body ?? {}) as { role?: unknown };
    const chosen = typeof body.role === 'string' ? body.role : '';
    if (chosen !== 'admin' && chosen !== 'developer') {
      res.status(400).json({ error: "role must be 'admin' or 'developer'" });
      return;
    }
    if (!claims.id || !claims.email) {
      res.status(400).json({ error: 'token payload missing id/email' });
      return;
    }
    const email = claims.email.toLowerCase();
    let binding: OrgBinding = { orgId: null, isOriginalDevs: false, createdNewOrg: false };
    let newLocalRole = claims.role || 'user';
    if (chosen === 'admin') {
      // Reuse the supabase_user_id we don't actually need here — pass
      // an empty string; ensureMembership only patches when present.
      binding = resolveAdminOrg(email, claims.username || '', '');
      // Original-devs get the legacy users.role='admin' upgrade so the
      // requireAdmin middleware opens for them. Self-serve admins keep
      // users.role='user' and rely on org_memberships.role='admin'.
      if (binding.isOriginalDevs) {
        db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(claims.id);
        newLocalRole = 'admin';
      }
    }
    // Developer choice: just record the intent; org_memberships is
    // populated later when they redeem an invite (future work).
    logEvent(
      claims.id,
      'auth.google.finalize-role',
      `chose=${chosen} orgId=${binding.orgId ?? '-'} newOrg=${binding.createdNewOrg}`
    );

    const token = jwt.sign(
      {
        id: claims.id,
        username: claims.username,
        email: claims.email,
        role: newLocalRole,
        orgId: binding.orgId,
        isOriginalDevs: binding.isOriginalDevs,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: claims.id,
        username: claims.username,
        email: claims.email,
        role: newLocalRole,
        orgId: binding.orgId,
        isOriginalDevs: binding.isOriginalDevs,
      },
      chosenRole: chosen,
      orgCreated: binding.createdNewOrg
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
