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

