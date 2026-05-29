'use client';

// Client wrapper for every public/marketing route. Reuses the existing MarketingShell
// verbatim (nav + footer + motion + lenis + chooser).
//
// ssr:false (D89 revision, 2026-05-29): these surfaces are animation/interaction-heavy
// (motion reveals, lenis smooth-scroll). Server-rendering their HTML made the animations
// janky — the pre-rendered content fought the client reveal/hydration. The product is an
// authenticated developer tool, not an SEO/marketing site, so there is no SSR payoff to
// trade for. Render client-only so motion/lenis play from a clean mount, exactly like the
// original Vite SPA. Vercel still hosts the app and proxies /api,/auth,/health to AWS
// server-side (that proxy — not page SSR — is what keeps the AWS origin + .env hidden and
// makes Vercel the apparent backend).
import dynamic from 'next/dynamic';
import type { Surface } from '@frontend/logic/router';

const MarketingShell = dynamic(
  () => import('@frontend/components/marketing/MarketingShell'),
  { ssr: false },
);

export default function MarketingSurface({
  surface,
}: {
  surface: Exclude<Surface, 'studio'>;
}) {
  return <MarketingShell surface={surface} />;
}
