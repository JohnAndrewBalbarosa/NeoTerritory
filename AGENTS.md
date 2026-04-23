# Agent Operating Rules

## Primary Boundary
Codex works on documentation architecture only unless Drew explicitly says to edit actual code.

Default allowed scope:
- `docs/**`
- `AGENTS.md`
- `.codex/**`
- `CLAUDE.md`

Default blocked scope:
- `Codebase/**`
- `tools/**`
- build files
- source files
- header files
- frontend runtime files
- backend runtime files
- test implementation files

If a request is about architecture, flow, Mermaid diagrams, file structure, design-pattern logic, middleman design, migration planning, or implementation guidance, Codex must express the answer through Markdown documents under `docs/Codebase`.

## Docs Are The Blueprint
The `docs/Codebase` tree is the intended implementation blueprint. Folder names and Markdown file names should be treated as future code folder/file structure.

Do not add documentation-only folders that would pollute the future code structure. Keep granular details inside the matching Markdown file instead of creating support folders.

## Implementation Handoff
Claude or another implementation agent will implement actual code based on the docs. Codex should make the docs clear enough for that implementation agent to follow without guessing.

Codex should document:
- intended file and folder structure
- ownership boundaries
- shared logic
- pattern-specific logic
- step-by-step flow
- Mermaid diagrams with short labels
- migration order
- acceptance checks

Codex should not implement:
- C++ logic
- JavaScript logic
- build scripts
- generated runtime files
- test code
- source/header refactors

## Mermaid Rules
Mermaid diagrams must use short phrases per node and show logical flow. If a process is detailed, split it into multiple small Mermaid blocks inside the same Markdown file.

Each Mermaid block should stay at or below 10 defined process nodes where practical.

## If Code Changes Seem Needed
Do not edit code. Instead:
1. Update the relevant docs under `docs/Codebase`.
2. Add a clear implementation note.
3. Add acceptance checks for Claude.
4. Stop at the docs boundary.

