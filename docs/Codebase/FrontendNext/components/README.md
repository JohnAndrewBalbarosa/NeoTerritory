# components (FrontendNext)

- Folder: docs/Codebase/FrontendNext/components
- Owner: FrontendNext

## Logic Summary
Thin Next-side client wrappers that adapt the shared `@frontend` components to App Router
route segments. They contain no UI of their own — they exist only to carry the `'use client'`
boundary and pass route-derived props into the reused Vite components.

## Files
- `MarketingSurface.tsx` — `'use client'` wrapper around `@frontend/components/marketing/
  MarketingShell`. Every public/marketing route segment (`app/page.tsx`, `app/learn/...`,
  `app/about/...`, `app/mechanics/...`, `app/patterns*`, `app/tour/...`, `app/docs/...`,
  `app/research/...`, `app/why/...`, `app/not-found.tsx`) renders `<MarketingSurface
  surface="X" />`. The shell provides nav + footer + motion + lenis + the Try-It chooser and
  switches on the `surface` prop, exactly as the Vite `App.tsx` did. Next server-renders the
  initial HTML; the shell hydrates on the client.

## Auth-gated wrappers (browser-only islands)
Auth surfaces have no SSR value (they need the localStorage JWT + browser APIs), so each is
a `'use client'` wrapper that loads its component via `next/dynamic` with `ssr: false`. This
renders them client-only — avoiding `window`/`localStorage` access during prerender — and
keeps their heavy bundles off the server path. Wrappers:
- `StudioSurface.tsx` → `@frontend/components/studio/StudioApp` (routes: /studio, /app,
  /developer, /student-studio)
- `SignInSurface.tsx` → `@frontend/components/auth/GoogleSignInPage` (routes: */login)
- `LearnHubSurface.tsx` → `@frontend/components/learn/StudentLearningShell` (routes:
  /patterns/learn[/<moduleId>])
- `AuthCallbackSurface.tsx` → `@frontend/components/auth/GoogleCallback` (/auth/callback)
- `OnboardingSurface.tsx` → `@frontend/components/auth/OnboardingFlow` (/onboarding/*)
- `AdminSurface.tsx` → `@frontend/admin/AdminApp` (/admin; was admin.html). Tabs are React
  state, not path segments, so /admin is a single route; /admin/login is separate.
- `ScraperSurface.tsx` → `@frontend/components/scraper/ScraperPanel` (/scraper; was
  scraper.html). The route page also imports `@frontend/styles/scraper.css` (the global
  marketing.css comes from the layout).

## Notes
- Slug-bearing routes (`patterns/[slug]`, `patterns/learn/[moduleId]`) currently let the
  reused component read the slug client-side (window-guarded); threading the slug as a prop
  for full SSR is a B2.2 item.
