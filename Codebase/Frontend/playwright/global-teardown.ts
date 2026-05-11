import { request, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Final safety net for the SHARED_SEAT in all-samples.spec.ts. The spec's
// test.afterAll releases the seat on a clean exit, but a Playwright worker
// crash (or a process-level SIGKILL from a runaway test) skips afterAll
// entirely — leaving the tester account in `claimed=true` state and
// breaking the next CI run with /auth/claim returning falsy (the exact
// cascade that masked the real `#status-title` regression).
//
// Strategy: when the spec claims a seat it writes the JWT + username to
// .playwright-seat.json. This teardown runs unconditionally at the end of
// the Playwright process (even on crash, Playwright still attempts
// globalTeardown). We read the file, POST /auth/disconnect with the
// stashed token, and unlink the file. Idempotent: missing file or a
// failed disconnect are both no-ops.

const SEAT_FILE = path.resolve(__dirname, '..', '.playwright-seat.json');

interface PersistedSeat {
  username: string;
  token: string;
}

export default async function globalTeardown(config: FullConfig): Promise<void> {
  let seat: PersistedSeat | null = null;
  try {
    if (!fs.existsSync(SEAT_FILE)) return;
    seat = JSON.parse(fs.readFileSync(SEAT_FILE, 'utf8')) as PersistedSeat;
  } catch {
    // Corrupt file — nothing to release; just remove it.
    try { fs.unlinkSync(SEAT_FILE); } catch { /* ignore */ }
    return;
  }
  if (!seat?.token || !seat?.username) {
    try { fs.unlinkSync(SEAT_FILE); } catch { /* ignore */ }
    return;
  }
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3001';
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${seat.token}` } });
  try {
    await api.post('/auth/disconnect', {
      headers: { 'Content-Type': 'application/json' },
      data: { username: seat.username },
    });
  } catch {
    // Network/server already gone — fine; file gets unlinked below so the
    // next run starts clean.
  } finally {
    await api.dispose();
    try { fs.unlinkSync(SEAT_FILE); } catch { /* ignore */ }
  }
  // Silence the unused param warning while keeping the standard signature.
  void config;
}
