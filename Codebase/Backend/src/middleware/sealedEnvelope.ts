// Stateless asymmetric day-key envelope verifier (Tier-2 implementation per
// docs/SECURITY.md §8). Designed to be applied to a future "sealed" route
// group (`/api/sealed/*`) without disturbing the existing bearer-JWT auth.
//
// Contract:
//   - Client posts a JSON body shaped { envelope, signature, sessionId }.
//   - envelope is an object containing { nonce, dayUtc, payload, ... }.
//   - signature is base64-encoded over the canonical JSON of envelope.
//   - sessionId points at a per-session ECDSA P-256 public key the client
//     uploaded at /auth/session-init (see sessionKeystore below).
//
// The middleware accepts iff:
//   1. sessionId resolves to a known public key (TTL ≤ 7 days).
//   2. signature verifies against the canonical envelope JSON.
//   3. |systemDayUtc − envelope.dayUtc| ≤ 1.
//
// No DB writes happen during verify. The keystore is in-memory and purges
// on TTL. Restarting the backend invalidates every session — by design.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface StoredSession {
  publicKeyPem: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const sessions = new Map<string, StoredSession>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.expiresAt < now) sessions.delete(k);
}, 60 * 60 * 1000).unref();

export function registerSession(sessionId: string, publicKeyPem: string): void {
  if (!sessionId || !publicKeyPem) throw new Error('sessionId + publicKeyPem required');
  sessions.set(sessionId, { publicKeyPem, expiresAt: Date.now() + SESSION_TTL_MS });
}

export function dropSession(sessionId: string): void {
  sessions.delete(sessionId);
}

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

function dayDelta(a: string, b: string): number {
  const ta = Date.parse(a + 'T00:00:00Z');
  const tb = Date.parse(b + 'T00:00:00Z');
  return Math.abs(Math.round((ta - tb) / (24 * 60 * 60 * 1000)));
}

// Stable canonical JSON for signing — sort keys recursively so client and
// server produce the same byte stream regardless of property insertion order.
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize((value as Record<string, unknown>)[k])).join(',') + '}';
}

export const verifySealedEnvelope = (req: Request, res: Response, next: NextFunction): void => {
  const body = req.body as {
    sessionId?: unknown;
    envelope?: unknown;
    signature?: unknown;
  };
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const envelope = body.envelope as { nonce?: unknown; dayUtc?: unknown; userId?: unknown; payload?: unknown } | undefined;
  const signature = typeof body.signature === 'string' ? body.signature : '';

  if (!sessionId || !envelope || !signature) {
    res.status(400).json({ error: 'sessionId, envelope, and signature are required' });
    return;
  }
  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: 'session unknown or expired' });
    return;
  }
  const dayUtc = typeof envelope.dayUtc === 'string' ? envelope.dayUtc : '';
  if (!isValidIsoDate(dayUtc)) {
    res.status(401).json({ error: 'envelope.dayUtc malformed' });
    return;
  }
  if (dayDelta(dayUtc, todayUtcDateString()) > 1) {
    res.status(401).json({ error: 'envelope.dayUtc outside ±1 day window' });
    return;
  }
  if (typeof envelope.nonce !== 'string' || envelope.nonce.length < 16) {
    res.status(401).json({ error: 'envelope.nonce too short' });
    return;
  }
  // Verify the signature with ECDSA-SHA256 over the canonical envelope.
  let ok = false;
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(canonicalize(envelope));
    verifier.end();
    ok = verifier.verify(session.publicKeyPem, Buffer.from(signature, 'base64'));
  } catch {
    ok = false;
  }
  if (!ok) {
    res.status(401).json({ error: 'signature verification failed' });
    return;
  }
  // Pass the verified envelope through to the handler.
  (req as Request & { sealedEnvelope?: typeof envelope }).sealedEnvelope = envelope;
  next();
};
