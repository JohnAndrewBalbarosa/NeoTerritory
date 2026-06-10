# Docs map

This is the canonical map for `docs/`. Start here when you need to find the right guide, spec, or runbook.

## Read first

- `docs/Codebase/` - blueprint for `Codebase/`; one markdown file per real source file.
- `docs/Codebase/DESIGN_DECISIONS.md` - durable architecture and implementation decisions.
- `docs/auto/` - generated operational docs; do not edit by hand.

## Top-level guides

- `docs/AUTH_SETUP.md` - auth setup, env vars, and sign-in flow.
- `docs/DEPLOY.md` - deployment topology, pm2, nginx, and deploy script notes.
- `docs/SECURITY.md` - secrets, JWTs, sealed envelopes, and RLS.
- `docs/VERCEL_FRONTEND.md` - Vercel frontend notes.

## Functional areas

- `docs/ops/` - recurring operational runbooks.
- `docs/Research/` - bibliography, thesis support material, and research notes.
- `docs/Questionnaire/` - survey instruments and implementation roadmap.
- `docs/INFRA/` - infrastructure migration notes and future requirements.
- `docs/TODO/` - active work items kept separate from shipped docs.

## Codebase mirror

`docs/Codebase/` mirrors `Codebase/` one to one. If the docs and code disagree, the docs are the source of truth.

Before adding new design or flow changes:

1. Record the decision in `docs/Codebase/DESIGN_DECISIONS.md`.
2. Update the matching `docs/Codebase/<path>/<file>.md`.
3. Implement the corresponding code in `Codebase/`.

## Working rules

- Do not edit `docs/auto/` directly.
- Keep new docs under the existing top-level folders when possible.
- Add a short note in this file when a new top-level docs area is introduced.

## Related entry points

- `README.md` - project overview and quick start.
- `CLAUDE.md` - agent operating contract.
- `AGENTS.md` - agent-specific scope and rules.
