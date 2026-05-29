# FrontendNext

- Folder: docs/Codebase/FrontendNext
- Status: Phase B2 (full Next.js App Router migration) — see DESIGN_DECISIONS **D89**.

## Logic Summary
`Codebase/FrontendNext` is the Next.js (App Router) host that replaces the Vite SPA as the
public frontend served from `neoterritory.vercel.app`. It server-renders the first-paint
HTML of the existing React surfaces and proxies all backend traffic to the AWS box. It does
not reimplement any UI: it **reuses the components under `Codebase/Frontend/src` verbatim**
via a build-time source alias, and adds only the Next shell (root layout, route segments,
the proxy config, and any streaming Route Handlers).

## Ownership Boundary
This folder owns: the Next root layout (`<html>/<body>`, global CSS load, fonts, metadata),
the route → surface mapping as App Router segments, the `/api`·`/auth`·`/health` proxy
(`next.config.js` rewrites), and — only if SSE buffering forces it — a streaming Route
Handler for `/api/analysis/run-events/:runId`.

It must NOT own: component implementations, design tokens/CSS, the zustand store, API
client, auth logic, analysis, pattern detection, or anything the C++ microservice/backend
own. Those stay in `docs/Codebase/Frontend`, `docs/Codebase/Backend`, and
`docs/Codebase/Microservice`. The Next app is a host and a proxy, not a second copy of the
app.

## Source Sharing (why this folder imports from a sibling)
To avoid duplicating the ~188KB `marketing.css`, the static assets, and the shared infra
(`store/appState`, `hooks/*`, `api/client.ts`), the Next app imports the existing source
through a webpack alias + `transpilePackages` in `next.config.js` and a tsconfig `paths`
entry (`@frontend/* → ../Frontend/src/*`). `Codebase/Frontend/src` therefore remains the
single source of UI until B2.3 internalises it. This is a deliberate, temporary cross-tree
import for the migration window, recorded in D89.

## SSR/CSR split
- **Public/marketing surfaces** (`/`, `/learn`, `/about`, `/mechanics`, `/patterns`,
  `/patterns/<slug>`, `/tour`, `/docs`, `/docs/full`, plus the retired-path 404s) render on
  the server for first paint, then hydrate. Because the components use `motion`/`lenis`/
  browser APIs, most carry `'use client'`; Next still emits their initial HTML.
- **Auth-gated surfaces** (`/patterns/learn[/*]`, `/studio` + aliases, `/admin[/*]`,
  `/scraper`, `/auth/callback`, `*/login`, `/onboarding/*`) are thin `'use client'` routes:
  their meaningful content depends on the `localStorage` JWT, so the server HTML is a shell
  that hydrates and then fetches through the proxy. No behaviour change vs. the Vite app.

## Proxy
`next.config.js` rewrites mirror the retired `vercel.json`: `/api/:path*`, `/auth/:path*`,
`/health` → `${AWS_BACKEND_ORIGIN}/...` (default `http://122.248.192.49`). Server-side proxy
is mandatory (an HTTPS Vercel page cannot call the plain-HTTP AWS box — mixed content);
it also removes any CORS need and keeps `client.ts` relative paths unchanged. See D88/D89.

## Doc-mirror granularity
Per D89, this tree documents at folder-README granularity plus a `.md` for each non-trivial
file (root layout, `next.config.js`, Route Handlers). Framework boilerplate (`package.json`,
`tsconfig.json`, `.gitignore`, `next-env.d.ts`) and one-line `'use client'` re-export route
files are covered by their parent folder README, not per-file specs.

## Build & deploy
- Local: `npm install` then `npm run build` (`next build`) inside `Codebase/FrontendNext`.
- Vercel: the production project Root Directory is flipped to `Codebase/FrontendNext` only
  after a green `next build`; until then the live site keeps building the Vite app via
  `vercel.json` (live-site safety, D89).
