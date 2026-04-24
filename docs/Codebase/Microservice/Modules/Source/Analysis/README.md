# Analysis

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis`
- Role: front half of the algorithm before tree identity and output shaping split into their own stages

## Read Order
1. `core.cpp.md`
2. `Input/`
3. `Lexical/`
4. `ImplementationUse/`
5. `Patterns/`

## Primary Entry
- Start with `core.cpp.md`.

## Boundary
- `Input/` owns source discovery and CLI-facing intake.
- `Lexical/` owns structural scanning and structural hook selection.
- `ImplementationUse/` owns actual code-use binding such as `p1 -> Person` and `p1.speak -> Person::speak`.
- `Patterns/` owns design-pattern interpretation after the structural and usage context is available.

## Workflow File
- `core.cpp.md` shows the whole stage workflow before the folder splits into local modules.

## Acceptance Checks
- Lexical scanning is separate from tree generation.
- Declaration logic does not get mixed with implementation-use resolution.
- Pattern folders appear only after the analysis boundary is clear.

