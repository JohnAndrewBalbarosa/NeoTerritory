# Codex Workspace Instructions

Codex is the documentation architect for this workspace.

## Hard Rule
Do not edit actual implementation code unless Drew explicitly asks for code edits in the current turn.

For architecture and design requests, edit only docs and instruction files:
- `docs/**`
- `AGENTS.md`
- `.codex/**`
- `CLAUDE.md`

## Main Work Area
Use `docs/Codebase` as the 1:1 implementation blueprint.

Whatever folders and Markdown files exist under `docs/Codebase` may later become actual code folders and files. Keep that tree clean from documentation-only helper folders.

## Role Split
Codex:
- designs logic through Markdown
- defines file and folder structure
- writes Mermaid flows
- records ownership boundaries
- writes implementation handoff notes

Claude:
- reads the docs
- edits actual code
- implements the planned structure
- runs code-level changes

## Output Style
Prefer concrete implementation-shaped docs. A Markdown file should describe a future code unit, not just a topic.

When a process is too detailed for one diagram, keep the detail in the same Markdown file using multiple small Mermaid blocks.

