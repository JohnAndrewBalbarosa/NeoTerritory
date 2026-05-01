// Admin pages race the bearer-token attach when they first mount; the
// /auth jwtAuth middleware then 401's with "Missing or invalid token".
// That message is operator-noise, not actionable, so wrap every admin
// fetch with this helper to convert auth/forbidden errors into a soft
// empty-state instead of a red banner.

interface ApiError extends Error {
  status?: number;
  detail?: string;
}

export function isAuthError(err: unknown): boolean {
  const e = err as ApiError | undefined;
  if (!e) return false;
  if (e.status === 401 || e.status === 403) return true;
  // apiFetch sometimes surfaces 401s as a plain Error before status
  // gets attached; match the canonical messages defensively.
  const msg = (e.message || '').toLowerCase();
  return msg.includes('missing or invalid token')
      || msg.includes('session expired')
      || msg.includes('unauthorized')
      || msg.includes('forbidden');
}
