// In-memory revocation list for JWTs that have been explicitly signed out.
// JWTs are stateless, so there is no built-in invalidate-on-logout. We keep a
// Set of revoked raw tokens; jwtAuth consults it on every request and rejects
// matches with 401. Entries are GC'd after 31 days (longer than the 30-day
// JWT lifetime) so the set cannot grow unbounded.
//
// This is a single-process store. A multi-instance EC2 deployment will need
// to migrate to Redis or a shared SQL table — tracked in
// docs/TODO/auth-and-deployment.md.

interface RevocationEntry {
  expiresAt: number;
}

const REVOCATION_TTL_MS = 31 * 24 * 60 * 60 * 1000;
const revoked = new Map<string, RevocationEntry>();

export function revokeToken(token: string): void {
  if (!token) return;
  revoked.set(token, { expiresAt: Date.now() + REVOCATION_TTL_MS });
}

export function isTokenRevoked(token: string): boolean {
  const entry = revoked.get(token);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    revoked.delete(token);
    return false;
  }
  return true;
}

// Periodic GC. Cheap walk; the set is small.
setInterval(() => {
  const now = Date.now();
  for (const [tok, entry] of revoked) {
    if (entry.expiresAt < now) revoked.delete(tok);
  }
}, 60 * 60 * 1000).unref();
