# next.config.js

- File: Codebase/FrontendNext/next.config.js
- Owner: FrontendNext (host/proxy config)

## Purpose
Configures the Next.js app: the backend proxy rewrites and the build-time sharing of the
existing `Codebase/Frontend/src` tree.

## Key behaviour
1. **Proxy rewrites** (mirrors the retired root `vercel.json`, see D88/D89):
   - `/api/:path*`   → `${AWS_BACKEND_ORIGIN}/api/:path*`
   - `/auth/:path*`  → `${AWS_BACKEND_ORIGIN}/auth/:path*`
   - `/health`       → `${AWS_BACKEND_ORIGIN}/health`
   - `AWS_BACKEND_ORIGIN` defaults to `http://122.248.192.49` (the AWS box on port 80; the
     bare IP is public infra, not a secret). Set as a Vercel env var to override.
   - Server-side proxy is mandatory: an HTTPS Vercel page cannot fetch the plain-HTTP AWS
     backend (mixed content). The rewrite is fetched by Vercel server-side, so the browser
     only sees HTTPS; this also removes any CORS requirement.
2. **Source sharing**: `transpilePackages` + a webpack alias (`@frontend → ../Frontend/src`)
   let the app import the existing components/CSS/store without copying them. Mirrored by a
   tsconfig `paths` entry so the type-checker resolves the same alias.

## Collaborators
- `Codebase/Frontend/src/**` — the shared component/CSS/store/api source (read-only import).
- The AWS Express backend — the rewrite target (`/api`, `/auth`, `/health`).

## Notes
- SPA-style fallback rewrites from `vercel.json` (`/admin → /admin.html`, etc.) are NOT
  carried over: those HTML entry points are replaced by Next route segments. The catch-all
  `/:path* → /index.html` is replaced by App Router routing + `app/not-found.tsx`.
- If SSE (`/api/analysis/run-events/:runId`) buffers through the generic rewrite, that one
  path is moved to a streaming Route Handler (documented separately) and excluded here.
