# app (Next.js App Router)

- Folder: docs/Codebase/FrontendNext/app
- Owner: FrontendNext

## Logic Summary
The App Router tree. Owns the root layout and one route segment per public/auth surface.
Each route reuses an existing component from `@frontend/components/...`. This folder is the
Next replacement for the Vite `index.html` + `src/main.tsx` + `src/App.tsx` dispatch and the
custom-router `useSurface()` switch.

## Files & segments
- `layout.tsx` (has its own `.md`): root `<html>/<body>`, imports the shared global CSS
  (`@frontend/styles/marketing.css`), declares fonts (Inter / JetBrains Mono / Montserrat)
  and default metadata. Wraps `children`. Server Component.
- `page.tsx`: the home surface (`/`). Mounts the existing `HeroLanding` (and, through it,
  the marketing chrome) as a client surface. Server-rendered first paint, then hydrates.
- Further segments are added in B2.1b, each a thin file that renders the existing component
  for that surface (public → server-rendered HTML; auth-gated → `'use client'` shell):
  `learn/`, `about/`, `mechanics/`, `patterns/` (+ `[slug]/`, `learn/`), `tour/`,
  `docs/` (+ `full/`), `studio/` (+ aliases), `admin/`, `scraper/`, `auth/callback/`,
  the `*/login` group, `onboarding/`, and `not-found.tsx` for retired/unknown paths.

## Mapping to the custom router
Route → surface follows `@frontend/logic/router#pathToSurface`. The pure slug helpers
(`patternSlugFromPath`, `learnModuleSlugFromPath`) are reused; dynamic segments
(`patterns/[slug]`, `patterns/learn/[moduleId]`) read Next `params` instead of
`window.location.pathname`.

## Doc granularity
Per D89: `layout.tsx` and any Route Handler get their own `.md`; thin `'use client'`
re-export route files (`page.tsx` for a surface that just renders one existing component)
are covered by this README.
