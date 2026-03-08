# Creational Detection + Transform Format

## Current Ownership

Creational pattern implementation is owned by the **Creational** module.

### Detection ownership

- `creational_broken_tree.cpp`
- `Factory/factory_pattern_logic.cpp`
- `Singleton/singleton_pattern_logic.cpp`
- `Builder/builder_pattern_logic.cpp`

### Transform ownership

- Public transform facade:
  - `Header/Creational/Transform/creational_transform_pipeline.hpp`
  - `Source/Creational/Transform/creational_transform_pipeline.cpp`
- Internal transform implementation:
  - `creational_code_generator_internal.cpp`
  - `creational_transform_rules.cpp`
  - `creational_transform_evidence.cpp`
  - `creational_transform_factory_reverse.cpp`

`SyntacticBrokenAST` no longer owns singleton/builder/factory transformation logic.

## Detection Roots

The aggregate creational root is:

- `CreationalPatternsRoot`

Detector sub-roots:

- `FactoryPatternRoot`
- `SingletonPatternRoot`
- `BuilderPatternRoot`

## Transform Rule Contract

Rule dispatch is creational-owned and currently supports:

1. `factory -> base` (reverse-factory to direct instantiation)
2. `singleton -> builder`
3. `* -> singleton`

`factory -> base` scope:

- scans single-line declaration-initializer callsites of:
  - `... = FactoryClass::create(literal);`
  - `... = factoryObj.create(literal);`
  - `... = factoryPtr->create(literal);`
- scans single-line assignment callsites of:
  - `var = FactoryClass::create(literal);`
  - `var = factoryObj.create(literal);`
  - `var = factoryPtr->create(literal);`
  - assignment rewrite requires a prior typed declaration for `var`; otherwise rewrite is skipped (`factory_result_declaration_unresolved`)
- supports literal argument mapping only (`"str"`, `'c'`, integer)
- maps `if/else-if` equality branches and `switch/case` branches in `create(...)`
- builds a hash ledger for each vital branch return:
  - vital line format: `return <creation-expression>;`
  - normalization: collapse ASCII whitespace and preserve expression order
  - hash id: deterministic `fnv1a64:<16-hex>` over normalized vital line
  - mapping shape: `literal -> {hash_id, creation_expression, normalized_vital_part}`
- resolves instance-call receiver type from typed factory declarations in the same monolithic source view
- rewrites declaration types only for:
  - `std::unique_ptr<Base>` -> `std::unique_ptr<Concrete>`
  - `std::shared_ptr<Base>` -> `std::shared_ptr<Concrete>`
  - `Base*` -> `Concrete*`
  - keeps `auto` unchanged
- preserves allocator style (`make_unique`, `make_shared`, `new`)
- records transform traces (`transform_trace`) with selected callsite/argument/hash-id/creation mapping
- skips ambiguous/unsupported callsites and records transform reasons
- removes now-unused factory instance declarations after successful inlining
- safely deletes the Factory class only when no remaining references exist outside class definition

Result contract from creational transform pipeline:

- transformed source text
- `TransformDecision[]` including:
  - `transform_applied`
  - `transform_reason[]`
  - `transform_trace[]` (hash-ledger and rewrite trace lines)

## Evidence View Contract

Creational evidence rendering owns base/target monolithic evidence output:

- `render_creational_evidence_view(source, target, target_view, source_pattern, target_pattern)`

Rendering mode is pattern-aware:

1. `singleton -> builder`:
   - emits evidence sections used by reporting:
     - source view: `EVIDENCE_PRESENT`
     - target view: `EVIDENCE_REMOVED`, `EVIDENCE_ADDED`
     - plus `TYPE_SKELETON` and `CALLSITE_SKELETON`
2. `factory -> base`:
   - base output remains source/base view (`generated_base_code.cpp`)
   - transformed output is emitted in target output (`generated_target_code_base.cpp`)
3. Other routes (including `* -> singleton`):
   - emits passthrough source/target code view
   - retains one preferred `main()` (matching `<source>_to_<target>` file hint when available) to keep generated `.cpp` outputs compilable.

## Factory Detection Backlog

Potential future extensions (not implemented in the current scope):

- factory alias methods (`make`, `build`, provider-specific names)
- enum/constexpr/identifier argument resolution beyond direct literals
- multi-line callsite parsing and chained/wrapped invocation forms
- constructor-wrapper or helper-function indirection resolution before inlining

## Structural Hook Ownership

Creational structural keyword hooks are provided by:

- `Header/Creational/Logic/creational_structural_hooks.hpp`
- `Source/Creational/Logic/creational_structural_hooks.cpp`

Supported pattern hooks:

- `factory` -> `FactoryStructuralStrategy`
- `singleton` -> `SingletonStructuralStrategy`
- `builder` -> `BuilderStructuralStrategy`
