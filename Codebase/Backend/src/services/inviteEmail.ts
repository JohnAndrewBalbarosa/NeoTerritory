// Send an invite email to a developer via Supabase Auth's admin invite
// endpoint (POST /auth/v1/admin/invite). Falls back to a no-op when
// SUPABASE_URL or SUPABASE_SERVICE_KEY is missing (dev envs); the
// admin page still lets the operator copy the invite link manually
// from the org_invites row.
//
// Fire-and-forget pattern. Return value indicates whether the call
// completed successfully so the caller can update email_status on the
// invite row, but the caller should NEVER block on this.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const REDIRECT_BASE = process.env.PUBLIC_BASE_URL || process.env.SITE_URL || '';

const enabled = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

let warnedOnce = false;

interface SendInviteOpts {
  email: string;
  orgName: string;
  inviterEmail: string;
}

export async function sendInviteEmail(opts: SendInviteOpts): Promise<boolean> {
  if (!enabled) {
    if (!warnedOnce) {
      warnedOnce = true;
      // eslint-disable-next-line no-console
      console.warn('[inviteEmail] SUPABASE_URL or SUPABASE_SERVICE_KEY unset — invite email skipped.');
    }
    return false;
  }
  try {
    const redirectTo = REDIRECT_BASE
      ? `${REDIRECT_BASE.replace(/\/+$/, '')}/auth/callback?role=developer&intent=new`
      : undefined;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/invite`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: opts.email,
        data: {
          org_name: opts.orgName,
          inviter: opts.inviterEmail,
          source: 'codineo-admin-onboarding',
        },
        ...(redirectTo ? { redirect_to: redirectTo } : {}),
      }),
    });
    if (!res.ok) {
      if (!warnedOnce) {
        warnedOnce = true;
        const body = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.warn(`[inviteEmail] Supabase invite failed (${res.status}): ${body.slice(0, 200)}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    if (!warnedOnce) {
      warnedOnce = true;
      // eslint-disable-next-line no-console
      console.warn('[inviteEmail] unreachable:', err instanceof Error ? err.message : err);
    }
    return false;
  }
}

export function isInviteEmailEnabled(): boolean {
  return enabled;
}
