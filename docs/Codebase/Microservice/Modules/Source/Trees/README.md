# Trees

- Folder: `docs/Codebase/Microservice/Modules/Source/Trees`
- Role: rooted tree ownership and class-declaration subtree generation

## Read Order
1. `core.cpp.md`
2. `MainTree/`
3. `ClassGeneration/`
4. `Shared/`

## Primary Entry
- Start with `core.cpp.md`.

## Boundary
- `MainTree/` owns the entry root, file nodes, and branch-attachment rules.
- `ClassGeneration/` owns actual class-declaration subtree generation at class scope.
- `Shared/` holds helpers that serve more than one tree-side branch.

## Workflow File
- `core.cpp.md` shows the whole tree-stage workflow before the folder splits into root ownership, class generation, and shared helpers.

## Acceptance Checks
- Tree generation is not hidden inside `Analysis/`.
- The docs treat virtual copy and broken AST as one branch.
- The docs show actual class-declaration subtree generation before structural pattern analysis.
- The docs show that the virtual-broken branch stays detached until matched evidence passes validation.
- Shared helpers stay under `Shared/`, not spread across sibling folders.



