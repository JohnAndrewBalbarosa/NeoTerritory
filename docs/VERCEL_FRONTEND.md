# Vercel Frontend Hosting (free HTTPS domain + AWS proxy)

Status: **Phase B1 shipped** — config only. The Vercel *project* still has to be
created/linked once by a human with the `vercel` CLI (see below). Design rationale:
`docs/Codebase/DESIGN_DECISIONS.md` → **D88**.

## What this gives you

- A free `https://<project>.vercel.app` URL for the whole frontend — no custom
  domain, no bare public IP.
- Zero backend rewrite: the C++ binary, Docker test pods, and Express backend stay
  on the AWS box (`http://122.248.192.49:3001`). Vercel only hosts the UI and
  **proxies** API traffic to AWS.

## How it works

`vercel.json` (repo root) builds the existing Vite SPA and rewrites requests:

| Request | Goes to |
|---------|---------|
| `/api/*`, `/auth/*`, `/health` | proxied **server-side** to `http://122.248.192.49:3001/...` |
| `/admin`, `/admin/*` | `/admin.html` (separate admin bundle) |
| `/scraper`, `/scraper/*` | `/scraper.html` |
| everything else | `/index.html` (SPA fallback) |
| `/assets/*` etc. | served as static files (filesystem wins before rewrites) |

**Why a proxy and not direct calls:** the Vercel page is HTTPS and the AWS backend
is plain HTTP. Browsers block HTTPS→HTTP ("mixed content"). The rewrite is fetched
by Vercel server-side, so the browser only ever talks HTTPS. Bonus: the frontend
keeps its relative `/api/*` paths unchanged, and there's no CORS to configure on the
proxy path (auth is a `localStorage` JWT — no cookies, no cross-origin session).

## One-time setup (run locally — needs your Vercel login)

The `vercel` CLI (v53.1.1) is already installed and authenticated on this machine.
From the repo root:

```bash
# Link this repo to a Vercel project (project root = repo root; vercel.json is read here)
vercel link

# First preview deploy (build runs on Vercel using vercel.json's build/install commands)
vercel

# Promote to production once the preview looks right
vercel --prod
```

If `vercel link` asks for a Root Directory, leave it as the repo root — the build
command in `vercel.json` already `cd`s into `Codebase/Frontend`.

## Rollback (the "blue-green" ask, frontend side)

Every Vercel deployment is immutable. To roll back instantly with zero downtime:

```bash
vercel rollback            # interactive: pick a previous deployment
# or
vercel rollback <deployment-url>
```

This is the frontend half of the rollback strategy. The AWS backend half is
`scripts/deploy-aws.sh --rollback` (dist-snapshot restore — see that script).

## ⚠️ Verification gate before trusting production: SSE streaming

The streaming test runner opens an `EventSource` to
`/api/analysis/run-events/:runId?token=…`. Confirm it streams live through the
Vercel rewrite (watch the test-run UI update token-by-token, not in one delayed
burst). If Vercel buffers or times out the SSE proxy:

1. Add a Next.js / Edge Route Handler that proxies *only* that endpoint with an
   explicit streaming response, **or**
2. Keep that single call pointed directly at AWS once the box has TLS.

Everything else (`/api/analyze` up to ~30s, multipart upload, login) goes through
the plain rewrite fine.

## SSR (Phase B2 — not done yet)

B1 hosts the existing client-rendered SPA. SSR is deferred because the app is a
27-surface custom-router Vite SPA (three entry points) and is authenticated, so
SSR's first-paint/SEO benefits are marginal and the migration is large. If pursued,
B2 server-renders only the **public/marketing** surfaces; **authenticated** surfaces
(studio, admin, learning, scraper) stay client-rendered because they depend on a
`localStorage` JWT. The analysis backend stays on AWS regardless.

## CI note

Adding `vercel.json` does not change what the existing CI builds or tests, so no
workflow edit was required. When Vercel becomes the **production public origin**,
repoint the Playwright/manifest base URL in `.github/workflows/*` in that same
change. The AWS post-deploy smoke (`scripts/ci-aws-post-deploy-smoke.mjs`) keeps
hitting AWS directly and stays valid for the backend contract.
