'use client';

// Single client wrapper for every public/marketing route. Reuses the existing
// MarketingShell verbatim (nav + footer + motion + lenis + chooser) and just passes
// the surface. Next server-renders the initial HTML; the shell hydrates on the client.
// See docs/Codebase/FrontendNext/components/README.md and D89.
import MarketingShell from '@frontend/components/marketing/MarketingShell';
import type { Surface } from '@frontend/logic/router';

export default function MarketingSurface({
  surface,
}: {
  surface: Exclude<Surface, 'studio'>;
}) {
  return <MarketingShell surface={surface} />;
}
