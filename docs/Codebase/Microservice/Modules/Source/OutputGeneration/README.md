# OutputGeneration

- Folder: `docs/Codebase/Microservice/Modules/Source/OutputGeneration`
- Role: everything emitted after analysis, tree generation, and identity resolution are complete

## Read Order
1. `core.cpp.md`
2. `UnitTestGeneration/`
3. `DocumentationTagger/`
4. `Report/`
5. `Render/`

## Primary Entry
- Start with `core.cpp.md`.

## Boundary
- `UnitTestGeneration/` owns future test-case shaping and pipeline acceptance outputs.
- `DocumentationTagger/` owns design-pattern tags and documentation-facing markers.
- `Report/` owns structured report assembly such as JSON fragments.
- `Render/` owns rendered views such as HTML and legacy output writers.

## Workflow File
- `core.cpp.md` shows the whole output-stage workflow before the folder splits into specific output channels.

## Acceptance Checks
- Unit-test generation is not mixed into reporting or rendering.
- Documentation tagging is visible as a separate output path.
- Output folders describe what is emitted, not the old source file prefixes.



