# Creational Detection Format

This folder uses parse-tree heuristics to detect creational-pattern structure.

## Virtual Detector + Creator (Decoupled)

Interfaces:

- `ICreationalDetector`
- `ICreationalTreeCreator`

Location:

- `creational_broken_tree.hpp` (interfaces + build overload)
- `creational_broken_tree.cpp` (default creator + default detector set)

Default detectors wired through the creator:

1. Factory detector (`build_factory_pattern_tree(...)`)
2. Singleton detector (`build_singleton_pattern_tree(...)`)
3. Builder detector (`build_builder_pattern_tree(...)`)

## Factory

Implementation: `Factory/factory_pattern_logic.cpp`

Detection chain:

1. `ClassNode`: parse-tree `Block` that starts with `class` or `struct`.
2. `FunctionNode`: child `Block` with function-like signature.
3. `ConditionalNode`: child `Block` that starts with `if`, `else if`, or `switch`.
4. `AllocatorReturn`: `ReturnStatement` inside conditional where return expression is:
   - `new ClassName(...)`, or
   - `make_unique<ClassName>(...)` / `make_shared<ClassName>(...)` / `allocate_shared<ClassName>(...)`
5. The returned class must exist in symbol table (`find_class_by_name`).

Output node kinds:

- `FactoryPatternRoot`
- `ClassNode`
- `FunctionNode`
- `ConditionalNode`
- `AllocatorReturn`

## Singleton

Implementation: `Singleton/singleton_pattern_logic.cpp`

Detection chain:

1. `ClassNode`: parse-tree `Block` that starts with `class` or `struct`.
2. Scan each class function body for:
   - `static <SameClass> <identifier>` declaration.
   - `return <same identifier>`.
3. If both appear in the same function, mark singleton candidate.

Output node kinds:

- `SingletonPatternRoot`
- `ClassNode`
- `SingletonFunction`
- `StaticInstanceDecl`
- `ReturnIdentifier`

## Builder (Structure Checker + Detector)

Implementation: `Builder/builder_pattern_logic.cpp`

Structure-check API:

- `check_builder_pattern_structure(const ParseTreeNode&)`

Per-class conformance format:

1. Collect class methods (`Block` function signatures).
2. Per method compute:
   - `mutates_state`: function subtree has `AssignmentOrVarDecl` or `MemberAssignment`.
   - `returns_self_type`: method signature return type resolves to class type.
   - `build_step`: method name is one of `build`, `create`, `make`, `result`, `getresult`, or starts with `build`.
3. Class conforms if:
   - `mutating_chainable_method_count >= 2`
   - and `has_build_step == true`.

Output node kinds:

- `BuilderPatternRoot`
- `ClassNode`
- `BuilderMethod`
- `BuildStepMethod`

## Aggregate Creational Root

Implementation: `creational_broken_tree.cpp`

Current aggregate includes:

- Factory detector
- Singleton detector
- Builder detector

