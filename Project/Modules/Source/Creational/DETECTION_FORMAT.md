# Creational Detection Format — Implementation Details

This module detects **Factory**, **Singleton**, and **Builder** patterns using **parse-tree heuristics** plus **symbol-table validation**.  
It builds a **pattern tree** (BrokenAST-style) and emits **explicit boolean candidates** in `analysis_report.json`.

---

## 1) Architecture: Virtual Detector + Tree Creator

### Interfaces

- `ICreationalDetector`
  - Responsibilities:
    - scan parse-tree + symbols
    - decide pattern candidate(s)
    - emit pattern nodes (Broken-tree nodes)
- `ICreationalTreeCreator`
  - Responsibilities:
    - orchestrate detectors
    - merge pattern subtrees under a unified root
    - standardize outputs and candidate booleans

### Locations

- `creational_broken_tree.hpp`
  - interface declarations
  - build overloads
- `creational_broken_tree.cpp`
  - default creator implementation
  - registers default detectors:
    1. factory detector (`build_factory_pattern_tree(...)`)
    2. singleton detector (`build_singleton_pattern_tree(...)`)
    3. builder detector (`build_builder_pattern_tree(...)`)

### Aggregate Creational Root

- Each detector returns a subtree rooted by:
  - `FactoryPatternRoot`
  - `SingletonPatternRoot`
  - `BuilderPatternRoot`
- The creator merges them under a single creational root node, e.g.:
  - `CreationalPatternRoot` (or equivalent module root)

---

## 2) Factory Detector — Implementation

**File:** `Factory/factory_pattern_logic.cpp`

### Goal

Detect a function that selects and returns a constructed object (allocation or object return), often via conditional dispatch.

### Parse-Tree Heuristic Chain

1. **ClassNode detection**
   - Scan parse-tree for `Block` nodes beginning with:
     - `class` or `struct`
   - Emit: `ClassNode`

2. **FunctionNode detection**
   - Inside class block, scan child `Block` nodes that parse as function signatures.
   - Emit: `FunctionNode`

3. **ConditionalNode detection**
   - In the function subtree, find conditional blocks starting with:
     - `if`, `else if`, `else`, `switch`
   - Emit: `ConditionalNode`

4. **Return evidence**
   - Search for `ReturnStatement` nodes in:
     - conditional subtree, and/or
     - fallthrough returns in the function body.
   - Extract return expression and classify evidence as:

   **AllocatorReturn** (strong evidence)
   - `new ClassName(...)`
   - `make_unique<ClassName>(...)`
   - `make_shared<ClassName>(...)`
   - `allocate_shared<ClassName>(...)`

   **ObjectReturn** (weaker evidence, guarded)
   - `ClassName(...)` (direct construction)
   - `identifier` where identifier resolves to local variable with known class type
   - `{ ... }` where function return type resolves to known class

5. **Symbol-table validation**
   - Returned class must exist:
     - `find_class_by_name(...)` must succeed.
   - For identifier returns:
     - identifier must resolve to local variable type that maps to a known class.

6. **Guard object-return classification**
   - ObjectReturn evidence is only accepted if at least one is true:
     - function/class name contains hints: `factory`, `creator`, `create`, `make`, `build`
     - or the same function already has AllocatorReturn evidence

### Output Nodes

- `FactoryPatternRoot`
- `ClassNode`
- `FunctionNode`
- `ConditionalNode`
- `AllocatorReturn`
- `ObjectReturn`

### Root Label Strategy

Recommended root label format:

- `class/function/conditional-or-fallthrough/allocator-or-object-return`

---

## 3) Singleton Detector — Implementation

**File:** `Singleton/singleton_pattern_logic.cpp`

### Goal

Detect a singleton-like accessor that returns a **single shared instance**.

### Current Minimal Heuristic (existing)

1. `ClassNode`: class/struct block
2. Within each class method body:
   - detect `static <SameClass> <identifier>;`
   - detect `return <identifier>;`
3. If both appear within the same function => candidate

### Improvements Required (so transforms trigger reliably)

#### A) Accessor signature gating

In addition to static local + return, require:

- accessor is a **class method**
- accessor is **static** (in signature)
- accessor return type resolves to:
  - `T&` (strong)
  - `T*` (strong)
  - `T` (weak but still eligible depending on mode)

#### B) Return expression forms

Accept:

- `return instance;`
- `return *instance;`
- `return &instance;`

#### C) Identifier binding validation

Ensure the returned identifier resolves to the detected `StaticInstanceDecl`.

### Output Nodes

- `SingletonPatternRoot`
- `ClassNode`
- `SingletonFunction`
- `StaticInstanceDecl`
- `ReturnIdentifier`

### Candidate strength (recommended fields)

- `singleton_strength = strong | weak`
- strong if return type is `T&` or `T*`
- weak if return type is `T` (copy-return)

---

## 4) Builder Detector — Implementation

**File:** `Builder/builder_pattern_logic.cpp`

### Goal

Detect classes that already behave like a builder (chainable setters + build step).

### Structure Check API

- `check_builder_pattern_structure(const ParseTreeNode&)`

### Per-Class Steps

1. Collect class methods (`Block` nodes that parse as functions)
2. For each method, compute:
   - `mutates_state`:
     - subtree contains `AssignmentOrVarDecl` or `MemberAssignment`
   - `returns_self_type`:
     - signature return type resolves to the same class type (or reference)
   - `build_step`:
     - method name is one of:
       - `build`, `create`, `make`, `result`, `getresult`
       - or starts with `build*`

3. Conformance decision:
   - `mutating_chainable_method_count >= 2`
   - AND `has_build_step == true`

### Output Nodes

- `BuilderPatternRoot`
- `ClassNode`
- `BuilderMethod`
- `BuildStepMethod`

---

## 5) Candidate Boolean Reporting (JSON)

**File:** `Project/Modules/Source/SyntacticBrokenAST/algorithm_pipeline.cpp`

### Required boolean fields (explicit)

- `class_registry[].refactor_candidate`
- `class_usages[].refactor_candidate`
- `line_hash_traces[].refactor_candidate_class`

### Diagnostics (not a candidate signal)

- `dirty_token_count` is diagnostic only and must not determine candidate status.

### Recommended additional fields (for debugging)

- `transform_applied: true|false`
- `transform_reason[]` when `false`, e.g.:
  - `singleton_candidate_not_found`
  - `singleton_candidate_weak_return_by_value`
  - `no_config_methods_for_builder_synthesis`
  - `ambiguous_match_multiple_classes`
  - `rewrite_failed_callsite_not_supported`
  - `output_write_failed`

---

## 6) Singleton → Builder Conversion (Transformation Requirements)

When `source_pattern=singleton` and `target_pattern=builder`:

### Minimum expected generated changes

- Introduce `TBuilder` class
- Introduce builder setter steps from configuration methods
- Add `build()` that returns `T`
- Rewrite callsites from:
  - `T::instance()` usage (and subsequent setters)
    into:
  - `TBuilder().set_x(...).set_y(...).build()`

### Configuration vs operational mutators (important)

- Configuration setters → builder steps:
  - names begin with: `set`, `with`, `enable`, `disable`, `configure`
- Operational methods remain on product:
  - e.g. `log`, `send`, `run`, `execute`

### If transformation is not applied

Do NOT silently pass-through.
Emit explicit reason(s) into report.

---

## 7) Quick Acceptance Checklist for Singleton → Builder

A generated output is considered valid if:

1. `class TBuilder` exists
2. `TBuilder::build()` exists and returns `T`
3. `main` (or callsites) no longer use `T::instance()` for construction/config
4. `analysis_report.json` has:
   - `transform_applied=true` for the class OR a clear `transform_reason[]` if false

---

## 8) Monolithic/Base Code View (Pattern Change Evidence Rules)

The generated base/target code view should be stripped to the smallest lines that prove the pattern change.

### Required sections

Each monolithic view output must contain:

1. `EVIDENCE_REMOVED` (source singleton markers expected to disappear)
2. `EVIDENCE_ADDED` (target builder markers expected to appear)
3. `MINIMAL_SKELETON` (smallest code skeleton that preserves callsite flow)

### Singleton evidence retained in source view

- `static <T> instance(...)`
- `static <T> <id>;` in accessor
- `return <id>;`, `return *<id>;`, or `return &<id>;`
- `<T>::instance()` callsites
- before callsite snippet:
  - `<T> obj = <T>::instance();`
  - `obj.set_...(...)`

### Builder evidence retained in target view

- `class <T>Builder`
- builder step methods returning `<T>Builder` or `<T>Builder&`
- `build()` (or recognized synonym) returning `<T>`
- rewritten callsite:
  - `<T> obj = <T>Builder().set_...( ... ).build();`

### Operational behavior evidence

Keep operational method usage after construction (for example, `obj.log(...)`) so runtime intent is still visible.
