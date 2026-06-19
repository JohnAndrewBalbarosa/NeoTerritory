// Single source of truth for the original-dev team's email allowlist.
// Anyone in this list, when they sign in via Supabase Google OAuth,
// gets pre-seeded membership in the NeoTerritory org with role=admin
// and the full thesis-grade tab set (Runs, Complexity, Users, Reviews,
// AI, Logs + Catalogs). Anyone else who Google-signs-in is offered the
// self-serve "create your own org" path.
//
// Update this list when the thesis team's emails change. Two of the
// three are placeholders until Miryl and Josephine confirm their
// preferred Google addresses.

export const ORIGINAL_DEV_EMAILS: ReadonlyArray<string> = [
  'jbalbarosa15@gmail.com',
  'balbarosa31@gmail.com',
  // TODO: replace with Miryl's confirmed Google account.
  'mirylzapanza@gmail.com',
  // TODO: replace with Josephine Santander's confirmed Google account.
  'santanderjosephine24@gmail.com',
];

export function isOriginalDevEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return ORIGINAL_DEV_EMAILS.some((e) => e.toLowerCase() === lower);
}

export const NEOTERRITORY_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const NEOTERRITORY_ORG_SLUG = 'neoterritory';

export const GUEST_SEAT_CAP = 50;
