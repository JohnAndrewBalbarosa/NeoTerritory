// Single source of truth for togglable frontend features. The developer
// admin (jbalbarosa15@gmail.com via the original-devs allowlist) flips
// each row from the Feature Releases tab in /admin; the backend persists
// the map in app_settings.feature_releases and the public client reads
// it via /auth/test-accounts (see fetchFeatureReleases in api/client.ts).
//
// Default to NOT released so unposted work stays hidden until an admin
// explicitly flips it on — this is the deploy gate. Each consumer checks
// `useFeatureReleases().isReleased(key)` before rendering its surface.

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  defaultReleased: boolean;
}

export const FEATURE_FLAGS: ReadonlyArray<FeatureFlag> = [
  {
    key: 'student-learning',
    label: 'Student Learning surface',
    description:
      'Standalone /patterns/learn shell + the "Learn more" CTA on the patterns catalog + the Learners card on /auth/choose.',
    defaultReleased: true,
  },
  {
    key: 'docs-trophy',
    label: 'Docs · Testing Trophy section',
    description:
      'Reveals the Testing Trophy doc section under /docs. Off by default until the writeup is ready.',
    defaultReleased: false,
  },
  {
    key: 'patterns-learn-cta',
    label: 'Patterns catalog · "Learn more" CTA',
    description:
      'The header CTA on /patterns that jumps to the learning hub. Hide when the learning hub itself is hidden.',
    defaultReleased: true,
  },
  {
    key: 'marketing-nav-docs',
    label: 'Marketing nav · Docs link',
    description: 'Top-nav entry for the public documentation surface.',
    defaultReleased: true,
  },
];

export function defaultReleaseMap(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of FEATURE_FLAGS) out[f.key] = f.defaultReleased;
  return out;
}
