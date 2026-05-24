// Org-scope resolution for analysis-time catalog assembly.
//
// The pattern-groups feature is per-org: an org's enabled/disabled GoF set
// plus its active custom groups determine which patterns the parser sees.
// This module centralises the "which org owns this analysis run?" decision
// so the analyze route and admin routes agree on the same legacy-org id.

// Legacy NeoTerritory original-devs org. Username/password admins (and any
// caller flagged isOriginalDevs) map here until Supabase OAuth wires real
// org membership onto the JWT.
export const LEGACY_ORIGINAL_DEVS_ORG_ID = '00000000-0000-0000-0000-000000000001';

// Resolve the org id whose pattern-group config should drive an analysis run.
//   - Explicit orgId on the user wins.
//   - Admins / original-devs without an explicit org fall back to the legacy
//     original-devs org so their own analyses honour the groups they configure.
//   - Everyone else (guests, devcon seats, solo devs) → null, i.e. the
//     pristine on-disk default catalog (no per-org assembly).
export function resolveAnalyzeOrgId(
  user: { orgId?: string | null; role?: string; isOriginalDevs?: boolean } | undefined | null
): string | null {
  if (!user) return null;
  if (user.orgId) return String(user.orgId);
  if (user.role === 'admin' || user.isOriginalDevs) return LEGACY_ORIGINAL_DEVS_ORG_ID;
  return null;
}
