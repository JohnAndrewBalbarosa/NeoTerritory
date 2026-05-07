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

Do NOT blindly run the full `start.sh` or `rebuild-and-deploy.sh` after every edit. The cost is in CMake configure (~40s on `/mnt/c/`) and Docker image rebuild (~15-20s) — neither is needed unless the relevant layer actually changed. The AI must infer the minimum rebuild from what was edited in this session.

### Run mode you are targeting
Two ways the studio runs:
- **Mode A — `start.sh --local` (dev with hot reload)**: backend uses `tsx watch` (auto-reloads TS), Vite serves frontend with HMR (auto-reloads TS/CSS). The C++ binary is loaded once at backend boot.
- **Mode B — Docker container `neoterritory:latest` on `:3001`**: everything (frontend bundle, backend, microservice binary, catalog) is baked into the image. ANY change requires image rebuild + container restart.

Ask or check before assuming. Default assumption: if `docker ps | grep neoterritory` shows a container, the user is on Mode B.

### What triggers what (Mode B / Docker — the strict case)

| Files changed | Required rebuild step |
|---------------|------------------------|
| `Codebase/Microservice/**/*.{cpp,hpp,h,cc}` only | C++ build → Docker rebuild → container restart |
| `Codebase/Microservice/**/CMakeLists.txt` or `*.cmake` | C++ configure + build → Docker rebuild → container restart |
| `Codebase/Microservice/pattern_catalog/**/*.json` only | Docker rebuild → container restart (no C++ build) |
| `Codebase/Backend/src/**/*.{ts,tsx,js,json}` only | Docker rebuild → container restart (no C++ build) |
| `Codebase/Frontend/src/**/*.{ts,tsx,css}` only | Docker rebuild → container restart (no C++ build) |
| Multiple of the above in one session | Single combined rebuild — `./scripts/rebuild-and-deploy.sh` (C++ + Docker + restart) |
| `package.json` / `package-lock.json` (Backend or Frontend) | Docker rebuild (full, with deps reinstall) → container restart |
| `Codebase/Infrastructure/session-orchestration/docker/Dockerfile` | Docker rebuild (force, no cache may be needed) → container restart |
| `docs/`, `*.md`, `.codex/instructions.md`, `CLAUDE.md`, `AGENTS.md` | NO rebuild needed |
| `scripts/*` | NO rebuild needed (scripts run on host) |
| `.gitattributes`, `.gitignore`, `.editorconfig` | NO rebuild needed |
| `tests/`, `playwright-scratch/`, `test-artifacts/` | NO rebuild needed (unless test code is the actual feature being shipped) |

### What triggers what (Mode A / dev hot reload)

| Files changed | Required action |
|---------------|------------------|
| `Codebase/Frontend/src/**` | Nothing — Vite HMR refreshes |
| `Codebase/Backend/src/**` | Nothing — `tsx watch` restarts the backend process |
| `Codebase/Microservice/**/*.{cpp,hpp,h,cc}` | `./scripts/rebuild-microservice.sh` then restart `start.sh` (or backend process) so the new binary is loaded. CMake reconfigure NOT required. |
| `Codebase/Microservice/**/CMakeLists.txt` | Re-run `start.sh` (full configure + build) |
| `Codebase/Microservice/pattern_catalog/**/*.json` | Nothing — catalog is read fresh per analysis call |
| `Codebase/Infrastructure/session-orchestration/docker/Dockerfile` | Doesn't apply in Mode A (Docker isn't used) |

### How the AI uses this

1. Track which files were edited in the current session (the AI already knows this from its tool use history).
2. Look up the highest-cost row in the matrix that matches.
3. Run **only** that rebuild step. Do not "be safe" by running more — that's how 40-second waits creep into every prompt.
4. State explicitly which rebuild step you ran and why, so the user can audit.
5. If unsure (e.g., user did `git pull` or has uncommitted changes you didn't make), prefer the safe default `./scripts/rebuild-and-deploy.sh` and explain why.

### Available scripts (cross-platform — no machine-specific tweaks)

- `./scripts/rebuild-microservice.sh` (or `.ps1`) — `cmake --build` only, no configure. Use for C++ source-only changes in Mode A.
- `./scripts/rebuild-and-deploy.sh` (or `.ps1`) — full cycle: C++ build → Docker rebuild → container restart → health check. Flags: `--skip-cpp`, `--skip-docker`. Use for Mode B.
- `start.sh --local` — full local dev environment (Mode A). Re-run when CMakeLists.txt changes or environment must be reset.

These scripts are checked in, work identically across machines (any WSL2 + Docker Desktop setup), and must NEVER be patched with developer-specific paths.

## Commit Cadence (Hard Rule)
Every user prompt that produces a code or doc change MUST end with a `git commit` on the current branch. The rule applies to ANY non-trivial change — UI logic, model edits, microservice tweaks, doc updates, CSS. Use a conventional-commit subject (e.g. `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) and include a short body when the change spans multiple modules. Do not skip the commit even if the user did not explicitly ask for it; this is the durable record of per-prompt progress and enables backtracking.

If a prompt produced ZERO file changes (pure question/discussion), no commit is required. If a prompt produced changes that fail type-check or build, fix forward in the same commit chain rather than leaving the tree dirty across prompts.

