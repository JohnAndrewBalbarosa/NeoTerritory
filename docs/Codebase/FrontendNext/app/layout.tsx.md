# app/layout.tsx

- File: Codebase/FrontendNext/app/layout.tsx
- Owner: FrontendNext/app
- Kind: Next.js root layout (Server Component)

## Purpose
The single root layout for the Next app. Replaces the Vite `index.html` frame. Owns the
`<html lang="en">` / `<body>` shell, loads the shared global stylesheet, declares the three
brand fonts, sets default `metadata`, and renders `{children}` (the active route segment).

## Key behaviour
- Imports `@frontend/styles/marketing.css` once, globally (the ~188KB shared design system).
- Fonts: Inter (400–800), JetBrains Mono (400–600), Montserrat (700–900) — matching the
  retired `index.html`. Loaded via `next/font/google` (preferred) or a `<link>` fallback.
- `export const metadata`: title `CodiNeo`, description matching the old marketing meta.
- No client hooks here; it stays a Server Component so every route under it can be SSR'd.

## Collaborators
- `@frontend/styles/marketing.css` — shared design system (read-only import).
- All `app/**` route segments render as `children`.

## Notes
- The legacy `/styles.css` (separate from `marketing.css`) and static assets
  (`cody_codineo_mascot.svg`, `team/`, `tour/`, `updates.json`) currently live under
  `Codebase/Frontend/public` and `Codebase/Frontend`. B2.1b wires these into Next's static
  serving (public dir or asset import) as surfaces that reference them are ported.
