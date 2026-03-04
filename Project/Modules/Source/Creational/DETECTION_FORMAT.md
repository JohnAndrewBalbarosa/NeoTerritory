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
3. `ConditionalNode`: child `Block` that starts with `if`, `else if`, `else`, or `switch`.
4. `AllocatorReturn`/`ObjectReturn`: `ReturnStatement` inside conditional subtree (or fallthrough return in the function body) where return expression is:
   - `new ClassName(...)`, or
   - `make_unique<ClassName>(...)` / `make_shared<ClassName>(...)` / `allocate_shared<ClassName>(...)`
   - `ClassName(...)`
   - `identifier` where identifier maps to a local variable declared with known class type
   - `{...}` when function return type resolves to a known class
5. The returned class must exist in symbol table (`find_class_by_name`).
6. `ObjectReturn` is gated to factory context to reduce false positives:
   - class or function name contains factory hints (`factory`, `creator`, `create`, `make`, `build`), or
   - the same function already contains allocator return evidence.

Output node kinds:

- `FactoryPatternRoot`
- `ClassNode`
- `FunctionNode`
- `ConditionalNode`
- `AllocatorReturn`
- `ObjectReturn`

Factory root label:

- `class/function/conditional-or-fallthrough/allocator-or-object-return`

## Candidate Boolean Reporting

Implementation: `Project/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp`

Analysis report (`analysis_report.json`) exposes explicit boolean candidate fields:

- `class_registry[].refactor_candidate`: class-level boolean summary.
- `class_usages[].refactor_candidate`: usage-level boolean.
- `line_hash_traces[].refactor_candidate_class`: line-trace boolean for the matched class.

`dirty_token_count` remains a diagnostics metric and is not used as the candidate decision field.

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

## Suggested Outline Plan and Contents

1. Expand factory return evidence
   Content: detect allocator returns and object-return indications (`new`, allocator templates, direct object returns, variable returns, brace-init returns).
2. Normalize control-flow coverage
   Content: evaluate both conditional branches (`if`/`else if`/`else`/`switch`) and fallthrough returns.
3. Guard object-return classification
   Content: only allow object-return evidence in factory context to avoid singleton or generic constructor false positives.
4. Expose explicit candidate booleans
   Content: publish `true`/`false` candidate fields at class, usage, and line-trace levels in JSON report.
5. Validate with reference sample
   Content: verify `ReportFactory` is a candidate and verify non-target classes remain non-candidates.
6. Keep diagnostics separate
   Content: retain `dirty_token_count` for tracing only; do not treat it as candidate status.

