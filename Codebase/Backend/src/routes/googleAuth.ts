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
import { sendInviteEmail } from '../services/inviteEmail';
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
const DEFAULT_FRONTEND_ORIGIN = 'https://neoterritory.vercel.app';
export const AUTH_CALLBACK_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

function authConfigured(): boolean {
  return !!SUPABASE_AUTH_URL && !!SUPABASE_ANON_KEY;
}

function normalizeOrigin(raw: string | undefined): string | null {
  if (!raw || raw === '*') return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function resolveFrontendCallbackOrigin(): string {
  const candidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.SITE_URL,
    process.env.FRONTEND_ORIGIN,
    process.env.CORS_ORIGIN,
    DEFAULT_FRONTEND_ORIGIN,
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }
  return DEFAULT_FRONTEND_ORIGIN;
}

export function buildFrontendCallbackRedirectHtml(
  frontendOrigin: string = resolveFrontendCallbackOrigin(),
): string {
  const safeOrigin = normalizeOrigin(frontendOrigin) || DEFAULT_FRONTEND_ORIGIN;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NeoTerritory sign-in</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; color: #111827; background: #f8fafc; }
    main { max-width: 34rem; padding: 2rem; }
    p { line-height: 1.5; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <main>
    <h1>Finishing sign-in</h1>
    <p id="message">Taking you back to NeoTerritory.</p>
    <p><a id="fallback" href="${safeOrigin}/auth/callback">Continue</a></p>
  </main>
  <script>
    (() => {
      const frontendOrigin = ${JSON.stringify(safeOrigin)};
      const target = new URL('/auth/callback', frontendOrigin);
      target.search = window.location.search;
      target.hash = window.location.hash;
      const fallback = document.getElementById('fallback');
      if (fallback) fallback.setAttribute('href', target.toString());
      const alreadyOnFrontendCallback =
        target.origin === window.location.origin &&
        target.pathname.replace(/\\/+$/, '') === window.location.pathname.replace(/\\/+$/, '');
      if (!alreadyOnFrontendCallback) {
        window.location.replace(target.toString());
        return;
      }
      const message = document.getElementById('message');
      if (message) {
        message.textContent = 'The auth callback reached the API backend. Deploy the frontend rewrite so /auth/callback serves the app.';
      }
    })();
  </script>
</body>
</html>`;
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

router.get('/callback', (_req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', AUTH_CALLBACK_CONTENT_SECURITY_POLICY);
  res.type('html').send(buildFrontendCallbackRedirectHtml());
});

// Find-or-create a local users row for a Supabase identity. We key on
// email when present (Google always provides one); falls back to a
// derived username when email is missing or already in use under a
// different role. The local row keeps NeoTerritory-side state (saved
// runs, reviews, surveys) joined to the user.
// Sign-in role intents. Picked pre-OAuth from the FE chooser:
//   'admin' — super admin tier; ONLY ORIGINAL_DEV_EMAILS allowed.
//             Non-allowlisted emails get a 403 with `allowed: false`.
//   'pm'    — self-serve org owner; anyone with a Google account can
//             pick this. Creates a fresh org on 'new' intent.
//   'developer' — joins an existing org (via invite) or stays solo.
//   'student'   — student-learning entry flow.
//   'new'   — first-timer; backend just mints a JWT with no org and
//             tells the FE to route to /onboarding/choose.
//   'unspecified' — legacy single-button path; no longer reached.
// 'learner' is the unified developer+student entry flow: a real account with
// no org binding and no existing-account 404 gate (a first-time Gmail is
// auto-registered). 'developer' / 'student' are kept for backward compat with
// in-flight front-end bundles and both map to 'learner' at the call site.
type SignInRole = 'learner' | 'developer' | 'student' | 'admin' | 'pm' | 'new' | 'unspecified';

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
function createSelfServeOrg(email: string, displayName: string, orgNameOverride?: string): string {
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
  const name = (orgNameOverride && orgNameOverride.trim())
    ? orgNameOverride.trim().slice(0, 64)
    : (displayName ? `${displayName}'s org` : slug);
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
  // sessions.
  //
  // Match rules:
  //   - Original-devs allowlist emails (Andrew/Miryl/Josephine) match
  //     ANY existing row, including role='admin'. This is important:
  //     after the first OAuth sign-in, /exchange bumps their local
  //     users.role to 'admin' (so the legacy requireAdmin gate opens).
  //     Subsequent sign-ins, even via role='pm' or role='new' intent,
  //     must STILL match that same row instead of trying to INSERT a
  //     duplicate (which fails on the email UNIQUE constraint).
  //   - Explicit role='admin' sign-in also matches any row.
  //   - Everything else excludes role='admin' rows so a fresh OAuth
  //     sign-in can never accidentally collide with the seeded
  //     `Neoterritory` legacy admin (`admin@neoterritory.local`) or a
  //     Devcon seat row (`devcon{N}@nodelivery.local`).
  if (email) {
    const matchAnyRole = isOriginalDevEmail(email) || role === 'admin';
    const matchClause = matchAnyRole
      ? `WHERE lower(email) = ? LIMIT 1`
      : `WHERE lower(email) = ? AND role NOT IN ('admin') LIMIT 1`;
    const existing = db.prepare(
      `SELECT id, username, email, role, password_hash FROM users ${matchClause}`
    ).get(email) as UserRow | undefined;
    if (existing) {
      // This account is authenticating via Google, so its provenance is
      // OAuth from here on. Correct a stale 'legacy'/'guest' created_via that
      // predates the Google sign-in (e.g. a legacy account that migrated to
      // OAuth) so the admin Provider column reflects reality (D87).
      db.prepare(`UPDATE users SET created_via = 'oauth' WHERE id = ? AND created_via != 'oauth'`)
        .run(existing.id);
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
    `INSERT INTO users (username, email, password_hash, role, created_at, created_via)
     VALUES (?, ?, ?, ?, datetime('now'), 'oauth')`
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

    const body = (req.body || {}) as { accessToken?: unknown; role?: unknown; intent?: unknown };
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
    const roleRaw = typeof body.role === 'string' ? body.role : '';
    let role: SignInRole;
    // 'learner' is the canonical unified flow; legacy 'student'/'developer'
    // values from in-flight bundles collapse to it.
    if (roleRaw === 'learner' || roleRaw === 'student' || roleRaw === 'developer') role = 'learner';
    else if (roleRaw === 'admin') role = 'admin';
    else if (roleRaw === 'pm') role = 'pm';
    else if (roleRaw === 'new' || roleRaw === 'new-user') role = 'new';
    else if (roleRaw === 'unspecified' || roleRaw === '') role = 'unspecified';
    else role = 'learner';
    const intent: 'existing' | 'new' =
      typeof body.intent === 'string' && body.intent === 'new' ? 'new' : 'existing';
    if (!accessToken) {
      res.status(400).json({ error: 'accessToken required' });
      return;
    }

    const supaUser = await verifySupabaseToken(accessToken);
    if (!supaUser) {
      res.status(401).json({ error: 'Invalid Supabase token' });
      return;
    }

    const probeEmail = (supaUser.email || '').toLowerCase();

    // Admin tier gate: 'admin' role is restricted to ORIGINAL_DEV_EMAILS.
    // Non-allowlisted emails picking the admin card get a 403 with
    // `allowed: false`; the FE offers a "Switch to PM sign-in" CTA.
    if (role === 'admin' && !isOriginalDevEmail(probeEmail)) {
      res.status(403).json({
        error: 'The admin tier is restricted to original developers. Pick PM instead.',
        allowed: false,
      });
      return;
    }

    // Intent='existing' contract: the user clicked "I already have an
    // account." If we cannot find them, we refuse to silently create
    // and instead let the front-end offer a "sign up instead" CTA. We
    // do this BEFORE upserting the local user so no orphan row is
    // created for a failed existing-login attempt.
    // The 'learner' flow never hits this gate: a first-time Gmail is always
    // auto-registered (intent is forced to 'new' on the FE), matching the old
    // student behaviour. Only admin/pm still verify an existing account.
    if (intent === 'existing' && (role === 'admin' || role === 'pm')) {
      const priorMembership = existingMembershipRole(probeEmail);
      const isOriginalDevs = isOriginalDevEmail(probeEmail);
      // Admin path: existing only if there is an admin membership OR
      // the email is in the original-devs allowlist (seed exists).
      if (role === 'admin' && priorMembership !== 'admin' && !isOriginalDevs) {
        res.status(404).json({
          error: 'No admin account exists for this email. Sign up first.',
          existing: false,
        });
        return;
      }
      // PM path: existing only if there is an admin membership in some
      // org (excluding the seeded original-devs org which belongs to
      // the admin tier). Otherwise prompt to sign up.
      if (role === 'pm' && priorMembership !== 'admin') {
        res.status(404).json({
          error: 'No PM account exists for this email. Sign up first.',
          existing: false,
        });
        return;
      }
    }

    const { row: localUser, wasNew } = upsertLocalUser(supaUser, role);

    // Org binding fires for admin + pm intent. For developer/student/new,
    // no org is attached automatically — developers redeem an invite or
    // request to join via the onboarding wizard; new users land sa
    // /onboarding/choose where they pick admin/developer.
    const email = (localUser.email || '').toLowerCase();
    let binding: OrgBinding = { orgId: null, isOriginalDevs: false, createdNewOrg: false };
    if (role === 'admin' || role === 'pm') {
      binding = resolveAdminOrg(email, localUser.username || '', supaUser.id);
      // Original-devs (the thesis team) get users.role='admin' so the
      // legacy requireAdmin gate opens for them too. Self-serve admins
      // (PMs) keep users.role='user' and rely on org_memberships.role.
      if (binding.isOriginalDevs && localUser.role !== 'admin') {
        db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(localUser.id);
        localUser.role = 'admin';
      }
    }
    const needsOnboarding = role === 'new' && binding.orgId === null;

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
      `role=${role} intent=${intent} username=${localUser.username} orgId=${binding.orgId ?? '-'} newOrg=${binding.createdNewOrg} wasNew=${wasNew}`
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
      needsOnboarding
    });
  } catch (err) {
    next(err);
  }
});

// (The /auth/google/finalize-role endpoint was removed when the
// sign-in UX moved role selection BEFORE OAuth — there is no longer
// a post-OAuth role prompt to commit. /exchange now does the binding
// in one round-trip based on the role+intent passed up front.)

// ────────────────────────────────────────────────────────────────────────
// Onboarding wizard endpoints (post-OAuth for brand-new users).
// ────────────────────────────────────────────────────────────────────────

interface BearerClaims {
  id?: number;
  username?: string;
  email?: string | null;
  role?: string;
  orgId?: string | null;
  isOriginalDevs?: boolean;
}

function verifyBearer(req: Request): BearerClaims | null {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) return null;
  try {
    return jwt.verify(bearer, process.env.JWT_SECRET as string) as BearerClaims;
  } catch {
    return null;
  }
}

function mintJwt(payload: {
  id: number;
  username: string;
  email: string | null;
  role: string;
  orgId: string | null;
  isOriginalDevs: boolean;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '30d' });
}

// SQLite mirror tables for invite codes and join requests. Created on
// demand; the production schema lives in Supabase migrations.
function ensureInviteTables(): void {
  db.prepare(`CREATE TABLE IF NOT EXISTS org_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'developer',
    token TEXT,
    email_sent_at TEXT,
    email_status TEXT DEFAULT 'queued',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, email)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_org_invites_email ON org_invites(email)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS org_invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_by INTEGER,
    uses_remaining INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_invite_codes_org ON org_invite_codes(org_id)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS org_join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_user_id INTEGER,
    requester_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    decided_by INTEGER,
    decided_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(org_id, requester_email)
  )`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_join_requests_org ON org_join_requests(org_id, status)`).run();
}

function isUserAdminOfOrg(userId: number, orgId: string): boolean {
  ensureInviteTables();
  const row = db.prepare(
    `SELECT 1 FROM org_memberships m
     INNER JOIN users u ON lower(u.email) = lower(m.email)
     WHERE u.id = ? AND m.org_id = ? AND m.role = 'admin' LIMIT 1`
  ).get(userId, orgId);
  return !!row;
}

function generateInviteCode(): string {
  // 6-char alphanumeric, easy to read aloud (no 0/O/1/I/L confusion).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// POST /auth/onboarding/admin — completes the admin onboarding wizard.
// Creates a fresh org (or rebinds to NeoTerritory for original-devs),
// records invite rows for any provided emails, fires invite emails
// fire-and-forget, re-mints the JWT.
router.post('/onboarding/admin', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.email) {
      res.status(401).json({ error: 'invalid or missing bearer token' });
      return;
    }
    const body = (req.body ?? {}) as { orgName?: unknown; inviteEmails?: unknown };
    const orgName = typeof body.orgName === 'string' ? body.orgName.trim() : '';
    if (!orgName) {
      res.status(400).json({ error: 'orgName is required' });
      return;
    }
    if (orgName.length > 64) {
      res.status(400).json({ error: 'orgName must be 64 characters or fewer' });
      return;
    }
    const inviteEmails: string[] = Array.isArray(body.inviteEmails)
      ? body.inviteEmails
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
          .slice(0, 50)
      : [];

    const email = claims.email.toLowerCase();
    const isOriginalDevs = isOriginalDevEmail(email);

    // Prevent double-onboarding: if user already has any admin
    // membership, refuse — they should hit the admin page instead.
    const existing = db.prepare(
      `SELECT org_id FROM org_memberships WHERE lower(email) = lower(?) AND role = 'admin' LIMIT 1`
    ).get(email) as { org_id: string } | undefined;
    let orgId: string;
    if (existing) {
      orgId = existing.org_id;
    } else if (isOriginalDevs) {
      orgId = NEOTERRITORY_ORG_ID;
      ensureMembership(orgId, email, '', 'admin');
    } else {
      orgId = createSelfServeOrg(email, claims.username || '', orgName);
      ensureMembership(orgId, email, '', 'admin');
    }

    // Bump local users.role to 'admin' for original-devs so the legacy
    // requireAdmin gate opens. PMs stay 'user'.
    let newRole = claims.role || 'user';
    if (isOriginalDevs && newRole !== 'admin') {
      db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(claims.id);
      newRole = 'admin';
    }

    // Record pending invites (idempotent on email per org) and fire the
    // invite-email service fire-and-forget. Real delivery depends on
    // Supabase Auth SMTP being configured; otherwise the invite stays
    // visible in the admin page so the operator can copy a link.
    ensureInviteTables();
    const inviteStmt = db.prepare(
      `INSERT OR IGNORE INTO org_invites (org_id, email, role, created_by, email_status)
       VALUES (?, ?, 'developer', ?, 'queued')`
    );
    for (const invitee of inviteEmails) {
      inviteStmt.run(orgId, invitee, claims.id);
      void sendInviteEmail({ email: invitee, orgName, inviterEmail: email }).then(
        (ok) => {
          db.prepare(
            `UPDATE org_invites SET email_status = ?, email_sent_at = ? WHERE org_id = ? AND email = ?`
          ).run(ok ? 'sent' : 'failed', new Date().toISOString(), orgId, invitee);
        },
        () => {
          db.prepare(
            `UPDATE org_invites SET email_status = 'failed' WHERE org_id = ? AND email = ?`
          ).run(orgId, invitee);
        }
      );
    }

    const token = mintJwt({
      id: claims.id,
      username: claims.username || '',
      email: claims.email,
      role: newRole,
      orgId,
      isOriginalDevs,
    });

    logEvent(
      claims.id,
      'auth.onboarding.admin',
      `orgId=${orgId} orgName=${orgName} invites=${inviteEmails.length} originalDevs=${isOriginalDevs}`
    );

    res.json({
      token,
      user: {
        id: claims.id,
        username: claims.username,
        email: claims.email,
        role: newRole,
        orgId,
        isOriginalDevs,
      },
      invitesQueued: inviteEmails.length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/onboarding/developer — completes the developer onboarding
// wizard. Branches on `mode`:
//   solo               → no membership, JWT unchanged.
//   invite-code        → look up org_invite_codes by code, attach.
//   request-by-email   → insert into org_join_requests; admin sees pending.
router.post('/onboarding/developer', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.email) {
      res.status(401).json({ error: 'invalid or missing bearer token' });
      return;
    }
    const body = (req.body ?? {}) as { mode?: unknown; code?: unknown; adminEmail?: unknown };
    const mode = body.mode;
    const email = claims.email.toLowerCase();

    ensureInviteTables();

    if (mode === 'solo') {
      logEvent(claims.id, 'auth.onboarding.developer', 'mode=solo');
      res.json({ ok: true, mode: 'solo' });
      return;
    }

    if (mode === 'invite-code') {
      const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!code) {
        res.status(400).json({ error: 'code is required' });
        return;
      }
      const row = db.prepare(
        `SELECT id, org_id, uses_remaining, expires_at FROM org_invite_codes WHERE code = ?`
      ).get(code) as { id: number; org_id: string; uses_remaining: number; expires_at: string | null } | undefined;
      if (!row) {
        res.status(404).json({ error: 'Invite code not found' });
        return;
      }
      if (row.uses_remaining <= 0) {
        res.status(410).json({ error: 'Invite code exhausted' });
        return;
      }
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        res.status(410).json({ error: 'Invite code expired' });
        return;
      }
      ensureMembership(row.org_id, email, '', 'developer');
      db.prepare(`UPDATE org_invite_codes SET uses_remaining = uses_remaining - 1 WHERE id = ?`).run(row.id);
      const token = mintJwt({
        id: claims.id,
        username: claims.username || '',
        email: claims.email,
        role: claims.role || 'user',
        orgId: row.org_id,
        isOriginalDevs: false,
      });
      logEvent(claims.id, 'auth.onboarding.developer', `mode=invite-code orgId=${row.org_id} code=${code}`);
      res.json({
        token,
        user: {
          id: claims.id,
          username: claims.username,
          email: claims.email,
          role: claims.role || 'user',
          orgId: row.org_id,
          isOriginalDevs: false,
        },
        mode: 'invite-code',
      });
      return;
    }

    if (mode === 'request-by-email') {
      const adminEmail = typeof body.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        res.status(400).json({ error: 'valid adminEmail is required' });
        return;
      }
      // Find an admin membership for that email.
      const target = db.prepare(
        `SELECT org_id FROM org_memberships WHERE lower(email) = lower(?) AND role = 'admin' LIMIT 1`
      ).get(adminEmail) as { org_id: string } | undefined;
      if (!target) {
        res.status(404).json({ error: 'No admin found for that email. Double-check spelling.' });
        return;
      }
      db.prepare(
        `INSERT OR IGNORE INTO org_join_requests (org_id, requester_email, requester_user_id, requester_name, status)
         VALUES (?, ?, ?, ?, 'pending')`
      ).run(target.org_id, email, claims.id, claims.username || null);
      logEvent(claims.id, 'auth.onboarding.developer', `mode=request orgId=${target.org_id} adminEmail=${adminEmail}`);
      res.json({ pending: true, mode: 'request-by-email' });
      return;
    }

    res.status(400).json({ error: "mode must be 'solo' | 'invite-code' | 'request-by-email'" });
  } catch (err) {
    next(err);
  }
});

// POST /auth/invite-code/create — admin generates a 6-char invite code.
router.post('/invite-code/create', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.orgId) {
      res.status(401).json({ error: 'invalid token or no org' });
      return;
    }
    if (!isUserAdminOfOrg(claims.id, claims.orgId)) {
      res.status(403).json({ error: 'must be an admin of the org' });
      return;
    }
    ensureInviteTables();
    let code = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      code = generateInviteCode();
      const exists = db.prepare(`SELECT 1 FROM org_invite_codes WHERE code = ?`).get(code);
      if (!exists) break;
    }
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO org_invite_codes (org_id, code, created_by, uses_remaining, expires_at)
       VALUES (?, ?, ?, 10, ?)`
    ).run(claims.orgId, code, claims.id, expires);
    logEvent(claims.id, 'auth.invite-code.create', `orgId=${claims.orgId} code=${code}`);
    res.json({ code, expiresAt: expires, usesRemaining: 10 });
  } catch (err) {
    next(err);
  }
});

router.get('/invite-code/list', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.orgId || !isUserAdminOfOrg(claims.id, claims.orgId)) {
      res.status(403).json({ error: 'must be an admin of the org' });
      return;
    }
    ensureInviteTables();
    const rows = db.prepare(
      `SELECT id, code, uses_remaining, expires_at, created_at
       FROM org_invite_codes
       WHERE org_id = ?
       ORDER BY created_at DESC`
    ).all(claims.orgId);
    res.json({ codes: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/join-request/list', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.orgId || !isUserAdminOfOrg(claims.id, claims.orgId)) {
      res.status(403).json({ error: 'must be an admin of the org' });
      return;
    }
    ensureInviteTables();
    const rows = db.prepare(
      `SELECT id, requester_email, requester_name, status, created_at, decided_at
       FROM org_join_requests
       WHERE org_id = ?
       ORDER BY (status = 'pending') DESC, created_at DESC`
    ).all(claims.orgId);
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/join-request/accept', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.orgId || !isUserAdminOfOrg(claims.id, claims.orgId)) {
      res.status(403).json({ error: 'must be an admin of the org' });
      return;
    }
    const body = (req.body ?? {}) as { requestId?: unknown };
    const requestId = Number(body.requestId);
    if (!Number.isFinite(requestId)) {
      res.status(400).json({ error: 'requestId required' });
      return;
    }
    ensureInviteTables();
    const row = db.prepare(
      `SELECT requester_email, status FROM org_join_requests WHERE id = ? AND org_id = ?`
    ).get(requestId, claims.orgId) as { requester_email: string; status: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'request not found' });
      return;
    }
    if (row.status !== 'pending') {
      res.status(409).json({ error: `already ${row.status}` });
      return;
    }
    ensureMembership(claims.orgId, row.requester_email, '', 'developer');
    db.prepare(
      `UPDATE org_join_requests SET status = 'accepted', decided_by = ?, decided_at = datetime('now') WHERE id = ?`
    ).run(claims.id, requestId);
    logEvent(claims.id, 'auth.join-request.accept', `requestId=${requestId} email=${row.requester_email}`);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/join-request/reject', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const claims = verifyBearer(req);
    if (!claims?.id || !claims.orgId || !isUserAdminOfOrg(claims.id, claims.orgId)) {
      res.status(403).json({ error: 'must be an admin of the org' });
      return;
    }
    const body = (req.body ?? {}) as { requestId?: unknown };
    const requestId = Number(body.requestId);
    if (!Number.isFinite(requestId)) {
      res.status(400).json({ error: 'requestId required' });
      return;
    }
    ensureInviteTables();
    db.prepare(
      `UPDATE org_join_requests SET status = 'rejected', decided_by = ?, decided_at = datetime('now')
       WHERE id = ? AND org_id = ? AND status = 'pending'`
    ).run(claims.id, requestId, claims.orgId);
    logEvent(claims.id, 'auth.join-request.reject', `requestId=${requestId}`);
    res.json({ ok: true });
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
