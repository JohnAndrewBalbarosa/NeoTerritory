# FrontendNext

- Folder: docs/Codebase/FrontendNext
- Status: Phase B2 (full Next.js App Router migration) — see DESIGN_DECISIONS **D89**.

## Logic Summary
`Codebase/FrontendNext` is the Next.js (App Router) host that replaces the Vite SPA as the
public frontend served from `neoterritory.vercel.app`. It renders the existing React
surfaces **client-side (CSR, `ssr:false`)** for smooth animations and proxies all backend
traffic to the AWS box server-side. It does not reimplement any UI: it **reuses the
components under `Codebase/Frontend/src` verbatim**
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

## Rendering model — CSR everywhere (D89 correction, 2026-05-29)
Every surface renders **client-side** (`next/dynamic({ ssr:false })`). There is no SSR page
rendering. Rationale: the app is animation-heavy (`motion`/`lenis`) and authenticated (no SEO
need), so server-rendering the HTML made the animations janky for zero payoff. Client
rendering plays the reveals from a clean mount, exactly like the original Vite SPA.
- **Public/marketing surfaces** (`/`, `/learn`, `/about`, `/mechanics`, `/patterns`,
  `/patterns/<slug>`, `/tour`, `/docs`, `/docs/full`, plus the retired-path 404s) →
  `MarketingSurface` (`ssr:false`) → `MarketingShell`.
- **Auth-gated surfaces** (`/patterns/learn[/*]`, `/studio` + aliases, `/admin[/*]`,
  `/scraper`, `/auth/callback`, `*/login`, `/onboarding/*`) → their own `ssr:false` wrappers;
  meaningful content depends on the `localStorage` JWT, fetched through the proxy after mount.
- **"Vercel is the backend" is the proxy, not SSR.** `next.config` rewrites forward
  `/api`·`/auth`·`/health` to AWS server-side (`AWS_BACKEND_ORIGIN`), so the browser only sees
  Vercel and the AWS origin + `.env` stay hidden. That is the entire server-side surface.

## Proxy
`next.config.js` rewrites mirror the retired `vercel.json`: `/api/:path*`, `/auth/:path*`,
`/health` → `${AWS_BACKEND_ORIGIN}/...` (default `http://122.248.192.49`). Server-side proxy
is mandatory (an HTTPS Vercel page cannot call the plain-HTTP AWS box — mixed content);
it also removes any CORS need and keeps `client.ts` relative paths unchanged. See D88/D89.

## Vite-ism handling (shared source under webpack)
The shared `Frontend/src` uses a few Vite-only mechanisms; the Next build handles them
without forking the source:
- **`?raw` imports** (C++ samples as strings, in `learningContent.ts`/`PatternAtlas.tsx`):
  a webpack `asset/source` rule in `next.config.js` + ambient types in
  `types/raw-assets.d.ts`. Works in both bundlers.
- **`import.meta.glob`** (was in `SamplePickerModal.tsx`, Vite-only): replaced by a
  generated explicit-`?raw` manifest `Frontend/src/components/analysis/
  sampleSources.generated.ts` (built by `scripts/gen-sample-sources.mjs`). Bundler-agnostic;
  behaviour-identical for the Vite app.
- **`import.meta.env.VITE_*` / `.PROD`** (GoogleSignInPage, useOverflowGuard): optional-
  chained, so they degrade to `undefined` under webpack without crashing. Functional env
  parity (e.g. an admin gate key) is wired via Vercel env vars if needed.

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
