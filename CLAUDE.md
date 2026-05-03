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

## Commit Cadence (Hard Rule)
Every user prompt that produces a code or doc change MUST end with a `git commit` on the current branch. The rule applies to ANY non-trivial change — UI logic, model edits, microservice tweaks, doc updates, CSS. Use a conventional-commit subject (e.g. `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`) and include a short body when the change spans multiple modules. Do not skip the commit even if the user did not explicitly ask for it; this is the durable record of per-prompt progress and enables backtracking.

If a prompt produced ZERO file changes (pure question/discussion), no commit is required. If a prompt produced changes that fail type-check or build, fix forward in the same commit chain rather than leaving the tree dirty across prompts.

