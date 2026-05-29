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

## Notes
- Slug-bearing routes (`patterns/[slug]`) currently let the reused detail component read the
  slug client-side (window-guarded); threading the slug as a prop for full SSR is a B2.2 item.
- Auth-gated surfaces do NOT use this wrapper; each mounts its own top component directly as
  a `'use client'` route (B2.1b-2 / B2.1b-3).
