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

There is **one canonical rebuild entry**: `./scripts/rebuild.sh` (or `./start.sh rebuild`). Default behavior with no flags is **rebuild every layer locally** (C++ → Docker image → container restart on `:3001` → `/api/health` check). It never pushes to AWS.

Flags are **EXCLUSIONS** — anything you pass is what gets skipped. The AI's job is to pick the smallest exclusion set that still covers what changed.

### Flag surface

| Flag | Skips |
|------|-------|
| `--skip-microservice` | `cmake --build` of the C++ microservice |
| `--skip-frontend` | (relies on Docker layer cache for the Vite frontend stage) |
| `--skip-backend` | (relies on Docker layer cache for the backend tsc stage) |
| `--skip-docker` | image build + container restart |
| `--mode-a` | switches the run target to `start.sh --local` (hot reload). Implies `--skip-docker`. |

PowerShell mirrors: `-SkipMicroservice`, `-SkipFrontend`, `-SkipBackend`, `-SkipDocker`, `-ModeA`.

### Run mode

- **Mode A — hot reload**: `./scripts/rebuild.sh --mode-a` rebuilds the C++ binary then hands off to `start.sh --local` (Vite HMR + `tsx watch`). No Docker.
- **Mode B — Docker container `neoterritory:latest` on `:3001`**: the default. The image bakes in frontend bundle + backend + microservice binary + catalog.

If `docker ps | grep neoterritory` shows a container, assume Mode B.

### What to run, by what changed (Mode B)

| Files changed | Command |
|---------------|---------|
| `Codebase/Microservice/**/*.{cpp,hpp,h,cc,cmake}` only | `./scripts/rebuild.sh --skip-frontend --skip-backend` |
| `Codebase/Microservice/pattern_catalog/**/*.json` only | `./scripts/rebuild.sh --skip-microservice --skip-frontend --skip-backend` |
| `Codebase/Backend/src/**/*.{ts,tsx,js,json}` only | `./scripts/rebuild.sh --skip-microservice --skip-frontend` |
| `Codebase/Frontend/src/**/*.{ts,tsx,css}` only | `./scripts/rebuild.sh --skip-microservice --skip-backend` |
| Multiple layers in one session | `./scripts/rebuild.sh` (no flags — full rebuild) |
| `package.json` / `package-lock.json` (Backend or Frontend) | `./scripts/rebuild.sh --skip-microservice` |
| `Codebase/Infrastructure/session-orchestration/docker/Dockerfile` | `./scripts/rebuild.sh --skip-microservice` |
| `docs/`, `*.md`, `.codex/instructions.md`, `CLAUDE.md`, `AGENTS.md` | NO rebuild needed |
| `scripts/*`, `.gitattributes`, `.gitignore`, `.editorconfig` | NO rebuild needed |
| `tests/`, `playwright-scratch/`, `test-artifacts/` | NO rebuild needed (unless tests are the feature) |

### What to run, by what changed (Mode A)

| Files changed | Command |
|---------------|---------|
| `Codebase/Frontend/src/**` | Nothing — Vite HMR refreshes |
| `Codebase/Backend/src/**` | Nothing — `tsx watch` restarts the backend |
| `Codebase/Microservice/**/*.{cpp,hpp,h,cc}` | `./scripts/rebuild.sh --skip-frontend --skip-backend --skip-docker` (then restart your `start.sh --local` so the new binary loads) |
| `Codebase/Microservice/**/CMakeLists.txt` | Re-run `start.sh --local` (full configure + build) |
| `Codebase/Microservice/pattern_catalog/**/*.json` | Nothing — catalog is read fresh per analysis call |

### Build-actually-happened proof

`scripts/rebuild.sh` prints **before/after sha256** for each rebuilt layer plus wall-clock timestamps. If a layer's hash didn't change, you'll see:

```
[rebuild.sh] WARN: <layer> hash unchanged — build may have been a no-op
```

If a "rebuild" finished in under ~10s and didn't print a hash diff, that's the canary: nothing actually rebuilt. Re-run with the right exclusion set, or check that the source files you think you changed are actually saved.

### How the AI uses this

1. Track which files were edited in the current session.
2. Pick the smallest matching row in the matrix above.
3. Run **only** that command. Default to `./scripts/rebuild.sh` (no flags) only when truly multiple layers changed, or when unsure.
4. State explicitly which command you ran and why.
5. Read the hash-diff lines. If you see `WARN: hash unchanged` for a layer you expected to change, stop and investigate — don't claim success.

### Available scripts

- **Canonical**: `./scripts/rebuild.sh` (POSIX) / `.\scripts\rebuild.ps1` (PowerShell). Also reachable as `./start.sh rebuild` and `.\start.ps1 rebuild`.
- **Legacy shims** (still work, print deprecation): `scripts/rebuild-and-deploy.{sh,ps1}` and `scripts/rebuild-microservice.{sh,ps1}`. Use the canonical entry in new code.
- `start.sh --local` — Mode A entry point. Re-run when `CMakeLists.txt` changes or the dev environment must be reset.

These scripts work identically across machines (any WSL2 + Docker Desktop setup) and must NEVER be patched with developer-specific paths.

## Commit Cadence (Hard Rule)
Every user prompt that produces a code or doc change MUST end with a `git commit` on the current branch. The rule applies to ANY non-trivial change — UI logic, model edits, microservice tweaks, doc updates, CSS. Use a conventional-commit subject (e.g. `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) and include a short body when the change spans multiple modules. Do not skip the commit even if the user did not explicitly ask for it; this is the durable record of per-prompt progress and enables backtracking.

If a prompt produced ZERO file changes (pure question/discussion), no commit is required. If a prompt produced changes that fail type-check or build, fix forward in the same commit chain rather than leaving the tree dirty across prompts.

