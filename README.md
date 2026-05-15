# NeoTerritory

> A C++ design-pattern analyzer and AI-assisted documentation generator. Built as an undergraduate thesis project (FEU Institute of Technology, in collaboration with DEVCON Luzon) and operated as a live, deployable web application.

<!-- VERSION BADGE START -->
**Current release:** `0.1.0 — 2026-05-12`
<!-- VERSION BADGE END -->

---

## What this is

NeoTerritory analyses class-level C++ source code, identifies design-pattern evidence using a **hash-based virtual structural copy** of the parse tree, and presents the findings as ranked, source-anchored explanations. An AI layer composes per-class documentation on top of the deterministic structural facts, with both layers clearly labelled so the AI output never replaces the structural ground truth.

The live site exposes a learner pathway (`/learn`, `/patterns`), a studio pathway (`/student-studio`), and a research / admin surface (`/admin`). The codebase mirrors `Codebase/` 1:1 against a markdown blueprint in `docs/Codebase/` — see `CLAUDE.md` for the docs-as-source-of-truth contract.

---

## Quick start

```bash
# Clone
git clone https://github.com/JohnAndrewBalbarosa/NeoTerritory.git
cd NeoTerritory

# Mode A — hot reload (Vite HMR + tsx watch, no Docker)
./start.sh --local

# Mode B — Docker (neoterritory:latest on :3001, the default)
./scripts/rebuild.sh
```

Full rebuild decision matrix lives in `CLAUDE.md` (sections "Rebuild Decision Matrix" and "What to run, by what changed"). Per-component scripts:

| Script | Builds |
|---|---|
| `ops/bash/rebuild/microservice.sh` | C++ binary via cmake |
| `ops/bash/rebuild/frontend.sh` | Vite bundle → `Codebase/Frontend/dist/` |
| `ops/bash/rebuild/backend.sh` | Backend tsc → `Codebase/Backend/dist/` |
| `ops/bash/rebuild/docker.sh` | `neoterritory:latest` image + container restart |

---

## Architecture (one-screen overview)

```
Codebase/
├── Microservice/        C++ analyzer — parse tree, virtual tree, pattern catalog (JSON)
├── Backend/             Node.js + Express — AI explanation, sessions, REST surface
├── Frontend/            React + Vite — marketing site, /student-studio, /admin
└── Infrastructure/      Docker, session orchestration, deploy plumbing
```

Five-stage analysis pipeline (described in detail on the live `/mechanics` page and in `docs/Codebase/Microservice/`):

1. **Lexical tagging** — every token assigned a category from `lexeme_categories.json`.
2. **Virtual + actual parse tree** — actual tree is immutable; virtual is the working copy.
3. **Per-class cross-referencing** — reverse index from class → function bodies that touch it.
4. **Virtual-only inspection** — one detector reads JSON pattern definitions and inspects the virtual tree.
5. **Pre-templated pattern matching** — patterns live as JSON files in `pattern_catalog/<family>/`. New pattern = drop a JSON, no recompile.

For the markdown blueprint of every file, see `docs/Codebase/`. For design decisions that survive across sessions, see `docs/Codebase/DESIGN_DECISIONS.md`.

---

## Latest release

<!-- LATEST RELEASE START -->

## 0.1.0 — 2026-05-12

The first labelled release. Captures 403 commits of feature work, fixes, refactors, and documentation. Future releases are generated from Conventional Commit subjects by `scripts/release.mjs`.

See [`CHANGELOG.md`](./CHANGELOG.md) for the full breakdown.

<!-- LATEST RELEASE END -->

The on-site `/docs` page surfaces the same content with a "Download as PDF" button per release.

---

## Releasing

Releases use a hybrid SemVer + date label (e.g. `0.1.0 — 2026-05-12`). The root `VERSION` file is the single source of truth.

```bash
node scripts/release.mjs --dry-run    # preview the next bump
node scripts/release.mjs              # bump VERSION, regenerate CHANGELOG.md + updates.json, tag
git push --follow-tags
```

The bump is inferred from commit types since the latest `v*` tag:

| Commit type seen | Bump |
|---|---|
| `feat!`, `fix!`, `refactor!`, or `BREAKING CHANGE` | major |
| any `feat:` | minor |
| only `fix:`, `refactor:`, `docs:`, `chore:`, `ci:`, `test:`, `perf:`, `style:`, `build:` | patch |

Override with `--bump=major|minor|patch` when policy requires it.

---

## Contributing

1. **Commits MUST follow Conventional Commits.** Format: `type(scope): subject`. Allowed types: `feat`, `fix`, `refactor`, `docs`, `chore`, `ci`, `test`, `perf`, `style`, `build`.
2. Every prompt that produces a code or doc change ends with `git add` → `git commit` → `git push` on the current branch. See `CLAUDE.md` → "Commit + Push Cadence" for the full rule.
3. Documentation under `docs/Codebase/` is the source of truth for `Codebase/`. If the two disagree, the docs win. Do not run `tools/generate_codebase_docs.ps1` to "fix" mismatches — that walker goes code → docs and would erase the blueprint.
4. Agent-specific behaviour rules live in `AGENTS.md` (Codex) and `CLAUDE.md` (Claude). Read both before opening a PR.

---

## Acknowledgements

This is the thesis project of John Andrew Balbarosa, Hans Christian De Leon, and Joshua Santander, submitted to the FEU Institute of Technology under the College of Computing and Information Technology, in collaboration with the DEVCON Luzon developer community. The role-delegation page on the live site (`/about`) credits per-feature contributions.

---

## License

See `LICENSE` (to be added).
