# next.config.js

- File: Codebase/FrontendNext/next.config.js
- Owner: FrontendNext (host/proxy config)

## Purpose
Configures the Next.js app: the backend proxy rewrites and the build-time sharing of the
existing `Codebase/Frontend/src` tree.

## Key behaviour
1. **Proxy rewrites** (mirrors the root `vercel.json`, see D88/D89):
   - `/api/:path*`   → `${AWS_BACKEND_ORIGIN}/api/:path*`
   - backend-owned `/auth/:path*` → `${AWS_BACKEND_ORIGIN}/auth/:path*`
   - `/health`       → `${AWS_BACKEND_ORIGIN}/health`
   - `/auth/callback` is served by `app/auth/callback/page.tsx`, not by the backend proxy,
     because Supabase returns the session in `window.location.hash`.
   - `AWS_BACKEND_ORIGIN` defaults to `http://122.248.192.49` (the AWS box on port 80; the
     bare IP is public infra, not a secret). Set as a Vercel env var to override.
   - Server-side proxy is mandatory: an HTTPS Vercel page cannot fetch the plain-HTTP AWS
     backend (mixed content). The rewrite is fetched by Vercel server-side, so the browser
     only sees HTTPS; this also removes any CORS requirement.
   - Rewrites are registered under `afterFiles` so real App Router files win before the
     backend proxy catches missing auth API paths.
2. **Source sharing**: `experimental.externalDir` + a webpack alias (`@frontend →
   ../Frontend/src`) let the app import the existing components/CSS/store without copying
   them. A second alias `@ → __dirname` resolves this app's own files (route files import
   `@/components/...`). Both are mirrored by tsconfig `paths` so the type-checker agrees.
3. **React dedup**: `resolve.modules` is prepended with this app's `node_modules` so the
   shared components don't pull a second React from `../Frontend/node_modules`. We do NOT
   alias the bare `react`/`react-dom` specifiers — that breaks Next 14's vendored server
   React with "r.cache is not a function".
4. **`?raw` assets**: a `module.rules` entry (`resourceQuery: /raw/ → asset/source`) makes
   Vite-style `import src from '....cpp?raw'` return the file text under webpack, matching
   Vite. The matching TypeScript ambient type lives in `types/raw-assets.d.ts`.

## Collaborators
- `Codebase/Frontend/src/**` — the shared component/CSS/store/api source (read-only import).
- The AWS Express backend — the rewrite target (`/api`, backend-owned `/auth`, `/health`).

## Notes
- SPA-style fallback rewrites from `vercel.json` (`/admin → /admin.html`, etc.) are NOT
  carried over: those HTML entry points are replaced by Next route segments. The catch-all
  `/:path* → /index.html` is replaced by App Router routing + `app/not-found.tsx`.
- If SSE (`/api/analysis/run-events/:runId`) buffers through the generic rewrite, that one
  path is moved to a streaming Route Handler (documented separately) and excluded here.
