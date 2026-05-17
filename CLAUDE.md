# Claude Implementation Handoff

This repository uses `docs/Codebase` as the implementation blueprint.

Codex is responsible for planning and documenting architecture in Markdown only. Claude is responsible for actual code implementation based on those docs.

## Docs Are The Source Of Truth (Hard Rule)
`docs/Codebase` is the source of truth — for both logic AND folder/file structure. The actual code under `Codebase/` must mirror `docs/Codebase/` one-to-one:

- Every `docs/Codebase/<path>/<name>.<ext>.md` defines a real code file at `Codebase/<path>/<name>.<ext>`.
- Every folder in `docs/Codebase/` is a real folder in `Codebase/` with the exact same name.
- Every `README.md` in `docs/Codebase/` corresponds to a `README.md` (or implied folder ownership) at the same path in `Codebase/`.
- If the code and the docs disagree, the docs win. Regenerate or move the code to match the docs — never adjust the docs to match the code.
- Do NOT run `tools/generate_codebase_docs.ps1` to "fix" mismatches. That tool walks code → docs and would erase the blueprint.
- Do not invent files or folders in `Codebase/` that are not described in `docs/Codebase/`. Do not leave files or folders behind in `Codebase/` if their corresponding doc was removed.

The markdown files describe the file's purpose, flow, collaborators, and key symbols. Use that description to write a real implementation. The descriptions are the spec; produce code that satisfies them.

## Implementation Source Of Truth
Before editing code, read:
- `AGENTS.md`
- `.codex/instructions.md`
- `docs/Codebase/DESIGN_DECISIONS.md` — durable design agreements that survive across sessions; read this so design nuance doesn't get re-derived inconsistently
- relevant files under `docs/Codebase`

When a new design call is made during implementation, record it in `docs/Codebase/DESIGN_DECISIONS.md` BEFORE writing dependent code. This protects design intent from context compression.

## Code Implementation Rule
Implement code from the docs. Do not assume that documentation-only support folders are implementation targets. The `docs/Codebase` tree itself is the intended future code/file structure.

## Expected Handoff Shape
Codex docs should define:
- target folders
- target files
- module ownership
- shared flow
- pattern-specific hooks
- migration order
- acceptance checks

Claude should implement the actual source changes after reviewing those docs.

## Rebuild Decision Matrix (Hard Rule)

Rebuilds are split into **four per-component scripts** under `ops/bash/rebuild/`. Each can be run directly:

| Script | Rebuilds |
|--------|----------|
| `ops/bash/rebuild/microservice.sh` | C++ binary via cmake |
| `ops/bash/rebuild/frontend.sh` | Host-side Vite bundle (`Codebase/Frontend/dist/`) |
| `ops/bash/rebuild/backend.sh` | Host-side backend tsc output (`Codebase/Backend/dist/`) |
| `ops/bash/rebuild/docker.sh` | `neoterritory:latest` image + container restart on `:3001` + `/api/health` check |

Two higher-level entry points dispatch to them:

1. **`./scripts/rebuild.sh`** — orchestrator. Default with no flags = `microservice + docker` (the canonical "local rebuild & redeploy" path; the Docker image already rebuilds frontend and backend internally, so host fe/be are opt-in via `--rebuild=`).
2. **`./start.sh --rebuild=<list>`** — runs the named rebuilds, then continues into the dev/prod stack. With no `--rebuild` flag, start.sh does **NOT** rebuild anything — it verifies the binary + node_modules and runs.

### Flag surface — `./scripts/rebuild.sh`

Inclusion list (preferred):

| Flag | Effect |
|------|--------|
| `--rebuild=microservice` | C++ binary only |
| `--rebuild=frontend` | Host Vite bundle only |
| `--rebuild=backend` | Host backend tsc only |
| `--rebuild=docker` | Image + container restart only |
| `--rebuild=all` | All four scripts |
| `--rebuild=microservice,docker` | Comma list — equivalent to bare default |

Exclusion flags (legacy, preserved):

| Flag | Skips |
|------|-------|
| `--skip-microservice` | cmake build |
| `--skip-docker` | image build + container restart |
| `--skip-frontend` / `--skip-backend` | accepted but no-op (host fe/be are opt-in via `--rebuild=`) |
| `--mode-a` | After rebuild, hand off to `start.sh --local` (hot reload). Implies `--skip-docker`. |

### Flag surface — `./start.sh`

| Flag | Effect |
|------|--------|
| _(none)_ | Verify-and-run — no rebuild |
| `--rebuild=<list>` | Run listed rebuilds before launching the dev/prod stack |
| `--rebuild` (bare, legacy) | Alias for `--rebuild=microservice` |
| `start.sh rebuild` | Pass-through to `scripts/rebuild.sh` (legacy, supports `--skip-*`) |

PowerShell mirrors for the per-component scripts are not yet implemented; the existing `.\scripts\rebuild.ps1` legacy entry still works for the canonical micro+docker path.

### Run mode

- **Mode A — hot reload**: `./scripts/rebuild.sh --mode-a` rebuilds the C++ binary then hands off to `start.sh --local` (Vite HMR + `tsx watch`). No Docker.
- **Mode B — Docker container `neoterritory:latest` on `:3001`**: the default. The image bakes in frontend bundle + backend + microservice binary + catalog.

If `docker ps | grep neoterritory` shows a container, assume Mode B.

### What to run, by what changed (Mode B)

The AI's default proposal when any code layer changed is **`./scripts/rebuild.sh`** (no flags — micro+docker). The AI does not pick `--rebuild=` or `--skip-*` flags on its own. The table below is reference; users can ask for a narrower rebuild explicitly.

| Files changed | Default command (AI uses this) |
|---------------|-------------------------------|
| Any of `Codebase/Microservice/**`, `Codebase/Backend/**`, `Codebase/Frontend/**`, `Codebase/Infrastructure/**`, `package.json` / `package-lock.json` | `./scripts/rebuild.sh` |
| `docs/`, `*.md`, `.codex/instructions.md`, `CLAUDE.md`, `AGENTS.md` | NO rebuild needed |
| `scripts/*`, `ops/bash/rebuild/*`, `.gitattributes`, `.gitignore`, `.editorconfig` | NO rebuild needed |
| `tests/`, `playwright-scratch/`, `test-artifacts/` | NO rebuild needed (unless tests are the feature) |

User-driven narrower runs (only when the user explicitly asks):

| User wants | Command |
|------------|---------|
| Just the C++ binary | `./scripts/rebuild.sh --rebuild=microservice` or `./ops/bash/rebuild/microservice.sh` |
| Just the Docker image + container restart | `./scripts/rebuild.sh --rebuild=docker` or `./ops/bash/rebuild/docker.sh` |
| Host-side frontend dist | `./ops/bash/rebuild/frontend.sh` |
| Host-side backend dist | `./ops/bash/rebuild/backend.sh` |
| Every layer (incl. host fe/be) | `./scripts/rebuild.sh --rebuild=all` |
| Run target → hot reload (`start.sh --local`) | `./scripts/rebuild.sh --mode-a` (implies `--skip-docker`) |

### What to run, by what changed (Mode A)

| Files changed | Command |
|---------------|---------|
| `Codebase/Frontend/src/**` | Nothing — Vite HMR refreshes |
| `Codebase/Backend/src/**` | Nothing — `tsx watch` restarts the backend |
| `Codebase/Microservice/**/*.{cpp,hpp,h,cc}` | `./ops/bash/rebuild/microservice.sh` (then restart your `start.sh --local` so the new binary loads) |
| `Codebase/Microservice/**/CMakeLists.txt` | Re-run `start.sh --local` (full configure + build) |
| `Codebase/Microservice/pattern_catalog/**/*.json` | Nothing — catalog is read fresh per analysis call |

### Build-actually-happened proof

Each per-component script prints a sha256 (file or image) before/after, so a no-op build is visible. If a "rebuild" finished suspiciously fast and the hash didn't change, that's the canary: nothing actually rebuilt. Re-check that the source files you think you changed are actually saved.

### How the AI uses this

1. If any code layer changed in this session, the AI's default proposal is **`./scripts/rebuild.sh`** (no flags — micro+docker).
2. The AI does NOT add `--rebuild=` or `--skip-*` flags on its own to "save time" or because only one layer was edited. Cache hits inside Docker already make untouched layers nearly free; the safety of a known-good full rebuild outweighs the marginal speedup.
3. Narrower commands are used ONLY when the user explicitly asks for them (e.g. "rebuild only the docker image"), or when a flag is structurally required (`--mode-a` for hot reload).
4. State explicitly which command you ran and why.
5. Read the hash-diff lines printed by each per-component script. If you see "after sha" matching "before sha" for a layer you expected to change, stop and investigate.

### Available scripts

- **Per-component (POSIX)**: `ops/bash/rebuild/{microservice,frontend,backend,docker}.sh` — runnable directly.
- **Orchestrator (POSIX)**: `./scripts/rebuild.sh` — accepts `--rebuild=<list>` and legacy `--skip-*`. Also reachable as `./start.sh rebuild`.
- **PowerShell**: `.\scripts\rebuild.ps1` legacy entry only (per-component PS1 mirrors not yet implemented).
- **Legacy shims** (still work, print deprecation): `scripts/rebuild-and-deploy.{sh,ps1}` and `scripts/rebuild-microservice.{sh,ps1}`.
- `start.sh --local` — Mode A entry point. Re-run when `CMakeLists.txt` changes or the dev environment must be reset.

These scripts work identically across machines (any WSL2 + Docker Desktop setup) and must NEVER be patched with developer-specific paths.

## Commit + Push Cadence (Hard Rule)
Every user prompt that produces a code or doc change MUST end with a `git commit` AND a `git push` on the current branch. Commit alone is not enough — the push is part of the cadence so the remote is always the durable record of per-prompt progress. The rule applies to ANY non-trivial change — UI logic, model edits, microservice tweaks, doc updates, CSS. Use a conventional-commit subject (e.g. `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) and include a short body when the change spans multiple modules. Do not skip the commit or the push even if the user did not explicitly ask for it.

Order each prompt's tail as: `git add` → `git commit` → `git push`. If the push fails (auth, network, non-fast-forward), surface the error to the user instead of silently leaving the commit unpushed; do not force-push to shared branches.

If a prompt produced ZERO file changes (pure question/discussion), no commit or push is required. If a prompt produced changes that fail type-check or build, fix forward in the same commit chain rather than leaving the tree dirty across prompts — then commit and push the fix.

## CI/CD Routes Manifest (Hard Rule)

The file `tests/routes.manifest.json` is the single source of truth for CI/CD's
route coverage. Every public route the website serves MUST have a row
there with: path, auth tier (`public|guest|developer|admin`), expected status,
and a stable `data-testid` selector on the rendered page. Admin routes are
listed too, but the auth-gated spec lives separately (login fixtures required);
the public manifest gate skips `auth: "admin"` rows automatically.

When ANY of the following changes in a prompt, the manifest MUST be updated in
the SAME commit:

- A new route is added to `Codebase/Frontend/src/logic/router.ts`
- An existing route's path is renamed, moved, or removed
- A page's top-level structure changes such that its `data-testid` anchor moves
- An auth tier shifts (e.g., a public route becomes admin-only)

Rendered pages MUST carry stable `data-testid` anchors that the manifest
references (`studio-shell`, `about-team-grid`, `docs-modal-overview`,
`docs-full-shell`, `patterns-family-grid`, `admin-tab-bar`, …). Do not delete
or rename a `data-testid` without updating the manifest.

The Playwright spec at `Codebase/Frontend/playwright/tests/manifest-driven.spec.ts`
reads the manifest and runs the smoke; the workflow at
`.github/workflows/routes-manifest.yml` invokes it. A route change without a
manifest update WILL cause a deterministic test failure with a clear "expected
selector X on /Y" message — that's the intended canary. Never "fix" the failure
by deleting the manifest row; fix the page or the route.

When adding a brand-new route or page in this session, the AI should:

1. Add the route to `router.ts` and the page component with its `data-testid`.
2. Add the matching row to `tests/routes.manifest.json` in the same commit.
3. State in the prompt summary which row was added.

## CI/CD Sync (Hard Rule)

The routes-manifest rule above is the canonical example. The general principle
is broader: **whenever a change in this repo can affect what CI tests, the
matching CI surface MUST be updated in the same commit.** Never let production
testing drift from production code.

The AI is responsible for spotting the drift and patching the CI surface
without waiting to be asked. Below is the trigger → CI-surface map. When
editing in this repo, scan the changes against this list before committing,
and update everything in the same commit.

### Trigger → CI surface to update

| Change category | If you touch… | …then update |
|------------------|---------------|----------------|
| **Public routes** | `Codebase/Frontend/src/logic/router.ts` (add/rename/retire path) OR page component's `data-testid` on the `<main>` shell | `tests/routes.manifest.json` (add/rename/remove row, keep selector pinned) |
| **Auth tiers** | A route's required role/auth changes (public ↔ guest ↔ developer ↔ admin) | `tests/routes.manifest.json` `auth` field on that row |
| **AWS post-deploy contract** | `Codebase/Backend/src/routes/*` (analyze, run-tests, health, /auth/*), AnalysisRun JSON shape, microservice binary contract | `scripts/ci-aws-post-deploy-smoke.mjs` (assertions must match) AND its unit tests in `scripts/__tests__/` if the runc-flake matcher or retry policy is involved |
| **Backend test suite** | New file under `Codebase/Backend/**/*.test.ts` or `*.spec.ts` | Verify the existing `Backend unit tests (vitest)` step in `.github/workflows/ci.yml` picks it up by glob; no edit needed if pattern catches it, but add a comment if the file is unusual |
| **Microservice build** | `Codebase/Microservice/CMakeLists.txt`, new source under `Codebase/Microservice/Modules/`, or change to `NEOTERRITORY_BIN`/`NEOTERRITORY_CATALOG` env contract | `.github/workflows/ci.yml` (`Build microservice` step and any env vars on `start the studio stack`) AND `.github/workflows/playwright-e2e.yml` (same env block) |
| **Playwright spec layout** | Add/rename a spec under `Codebase/Frontend/playwright/tests/` | If the new spec must run on every push (gating), reference it in `.github/workflows/playwright-e2e.yml` OR rely on the `Run manifest-driven Playwright spec` step's glob. Never leave a critical spec un-invoked. |
| **Frontend build step** | `Codebase/Frontend/package.json` scripts, new vite entry, new dependency that requires a build flag | Both `.github/workflows/ci.yml` (`Build Frontend (production)`) and `.github/workflows/routes-manifest.yml` (`Build Frontend (production)`) — they're parallel copies; keep them in sync |
| **Database / Supabase schema** | New migration under `supabase/migrations/`, change to `Codebase/Backend/src/db/initDb.ts` schema CREATE TABLE statements | Note in the commit message that `supabase db push` must run on the hosted project (CI does NOT apply migrations automatically). If a CI job depends on schema state (e.g. the smoke claims a Devcon seat that requires `SEED_TEST_USERS=1`), keep that env var aligned in the workflow YAMLs. |
| **CI-relevant env vars** | `Codebase/Backend/server.ts` reads a new `process.env.X` that gates behaviour the smoke depends on | Update `.github/workflows/ci.yml` AND `.github/workflows/playwright-e2e.yml` `Start the studio stack` blocks to set `X` to the test-mode value. Document defaults in `.env.example`. |
| **/admin route ownership** | Any change to which paths are served by `admin.html` vs `index.html` in `Codebase/Backend/server.ts` | Confirm `tests/routes.manifest.json` still resolves the right testid; the auth='admin' row stays exercised by the public smoke (currently auth='public' for /admin/login). |
| **Test runner contract** | The `phase` / `verdict` strings returned by `/api/analysis/run-tests`, or the response shape of `run-tests` | Update `scripts/ci-aws-post-deploy-smoke.mjs` assertions on `phase === 'compile_run'` etc. AND the matcher in `RUNC_FLAKE_PATTERNS` if a new flaky error class shows up. |

### Operating procedure (every commit)

Before committing, the AI should mentally scan its diff and ask:

1. **Did I add, rename, retire, or change auth on a public route?** → manifest must reflect it.
2. **Did I change any `/api/*` shape, status code, or contract that the AWS smoke probes?** → `scripts/ci-aws-post-deploy-smoke.mjs`.
3. **Did I add a Playwright spec or rename one?** → confirm a workflow step still picks it up.
4. **Did I introduce or change a server env var that gates test-mode behaviour?** → update both CI workflow YAMLs.
5. **Did I add a Supabase migration?** → call this out in the commit body and note whether the AWS host needs `supabase db push` to apply it.

If the answer to any of those is yes and the corresponding CI surface is NOT in the staged diff, the commit is incomplete. Fix forward in the same commit chain rather than landing the source change without its CI partner.

The reason this rule exists: tests are only useful when they actually exercise the production contract. A backend route that no smoke probes is a backend route the next deploy can silently break. A spec that ships under a renamed path but no workflow ever invokes is a spec that protects nothing. CI sync keeps the safety net taut.

When in doubt, prefer "update one row in the manifest / one selector in the smoke script" over "wait for the next CI failure to remind me." Treat the YAMLs and the manifest as first-class code, not paperwork.

