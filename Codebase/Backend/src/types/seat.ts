/**
 * Devcon seat-key session types.
 *
 * Invariants enforced at the type level:
 *   - `privateKey` is required ONLY on `SeatClaimResponse` — the one and only response
 *     where the server returns it. It must be `undefined` on every other shape, so the
 *     compiler will reject any handler that accidentally serializes a private key.
 *   - All session timing is expressed in seconds, never milliseconds, to match the spec.
 */

export type SeatStatus = 'available' | 'occupied';

export const SEAT_TTL_SECONDS = 60;
export const HEARTBEAT_INTERVAL_SECONDS = 30;

export interface SeatPublicState {
  username: string;
  status: SeatStatus;
  expiresInSeconds: number | null;
}

/** Returned by GET /auth/seat/state — never carries keys. */
export interface SeatRosterResponse {
  seats: readonly SeatPublicState[];
  ttlSeconds: number;
  heartbeatIntervalSeconds: number;
}

/** Returned ONCE by POST /auth/seat/claim. Contains the auto-generated private key. */
export interface SeatClaimResponse {
  username: string;
  publicKey: string;
  /** PEM-encoded RSA private key. Returned on claim only; never persisted server-side. */
  privateKey: string;
  publicKeyFingerprint: string;
  claimToken: string;
  expiresInSeconds: typeof SEAT_TTL_SECONDS;
  heartbeatIntervalSeconds: typeof HEARTBEAT_INTERVAL_SECONDS;
}

export interface HeartbeatRequest {
  username: string;
  claimToken: string;
  /** Base64-encoded RSA-PKCS1-v1_5 SHA-256 signature over claimToken using the held private key. */
  signature: string;
}

export interface HeartbeatResponse {
  username: string;
  expiresInSeconds: number;
  heartbeatIntervalSeconds: typeof HEARTBEAT_INTERVAL_SECONDS;
}

export interface ReleaseRequest {
  username: string;
  claimToken: string;
}

export interface ReleaseResponse {
  username: string;
  released: true;
}
