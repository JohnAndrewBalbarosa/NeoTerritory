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

## Folder And File Naming Rules
Codex must prefer logic-first structure over pattern-first or implementation-style spread.

Required order when designing docs paths:
1. subsystem or algorithm stage
2. module or shared function boundary
3. pattern family or implementation variant only if needed
4. local file that explains the concrete unit

Naming constraints:
- Do not lead with design-pattern names when the real outer boundary is an algorithm stage or subsystem.
- Do not name files as `pattern_name + what_the_code_does` when the folder path already carries that meaning.
- If multiple sibling files share the same conceptual prefix, convert that prefix into a folder and shorten the files inside it.
- Use folders aggressively to group overlapping logic, shared concepts, shared modules, shared libraries, and repeated functional stems.
- Apply the same rule to core logic, helper modules, library-like areas, contracts, and transformation docs.
- Use `Library/` only for genuinely shared reusable logic across sibling modules.
- Use `Common/` only when several files in one module share helper logic but do not justify a larger subsystem.

Examples:
- Prefer `HashingMechanism/HashLinks/collect.cpp.md` over `hash_links_collect.cpp.md`
- Prefer `Analysis/Patterns/Creational/Builder/core.cpp.md` over `builder_pattern_logic.cpp.md`
- Prefer `Trees/Broken/Creational/tree.cpp.md` over `creational_broken_tree.cpp.md`
- Prefer `OutputGeneration/UnitTestGeneration/core.cpp.md` over `algorithm_pipeline.cpp.md` when that file is the unit-test generation entrypoint

Entrypoint rule:
- Every major subsystem folder needs a `README.md`
- Every major module folder needs a `README.md` when a reader needs a clear starting point
- The `README.md` should explain read order, ownership boundary, and what belongs outside the folder
- If a wrapper folder only repeats the name of the one real subsystem inside it, collapse that wrapper and move the subsystem contents up one level
- When a source subsystem sits directly under `docs/Codebase/Microservice/Modules/Source`, prefer a real entry file such as `main.cpp.md` as the first read
- When a header subsystem sits directly under `docs/Codebase/Microservice/Modules/Header`, prefer a real entry file such as `main.hpp.md` as the first read

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

When a flow is split into multiple Mermaid blocks:
- do not label sections as only `Part 1`, `Part 2`, and so on
- give each slice an intent-first label that says what stage of the flow it represents
- add a short quick summary before the Mermaid block
- add a short note explaining why that slice is separated from the next one
- make the major purpose of the code visible either in the slice title, the quick summary, or the Mermaid node labels

## If Code Changes Seem Needed
Do not edit code. Instead:
1. Update the relevant docs under `docs/Codebase`.
2. Add a clear implementation note.
3. Add acceptance checks for Claude.
4. Stop at the docs boundary.
