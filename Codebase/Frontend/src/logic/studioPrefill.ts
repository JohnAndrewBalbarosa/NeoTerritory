// One-shot handoff between the marketing /learn surface and the studio at
// /app. The lesson page stashes a sample (filename + raw C++ source) here,
// then navigates to the studio. AnalysisForm consumes the stash on first
// mount so the user lands with the sample already loaded into slot 1.
//
// Lives in sessionStorage (not the zustand store) because StudioApp calls
// resetSession() on mount, which would otherwise wipe a freshly written
// store value before the form ever reads it.

const STUDIO_PREFILL_KEY = 'nt_studio_prefill_v1';

export interface StudioPrefill {
  name: string;
  code: string;
}

export function stashStudioPrefill(payload: StudioPrefill): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STUDIO_PREFILL_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable in privacy modes; the studio just
    // opens with an empty slot, which is the existing default.
  }
}

export function consumeStudioPrefill(): StudioPrefill | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STUDIO_PREFILL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STUDIO_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<StudioPrefill>;
    if (typeof parsed.name !== 'string' || typeof parsed.code !== 'string') return null;
    return { name: parsed.name, code: parsed.code };
  } catch {
    return null;
  }
}
