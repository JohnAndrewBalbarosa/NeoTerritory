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

1. `singleton -> builder`
2. `* -> singleton`

Result contract from creational transform pipeline:

- transformed source text
- `TransformDecision[]` (same schema used by existing reporting)

## Evidence View Contract

Creational evidence rendering owns base/target monolithic evidence output:

- `render_creational_evidence_view(source, target, target_view)`

It emits the same evidence sections used by current reporting:

- source view: `EVIDENCE_PRESENT`
- target view: `EVIDENCE_REMOVED`, `EVIDENCE_ADDED`
- plus `TYPE_SKELETON` and `CALLSITE_SKELETON`

## Structural Hook Ownership

Creational structural keyword hooks are provided by:

- `Header/Creational/Logic/creational_structural_hooks.hpp`
- `Source/Creational/Logic/creational_structural_hooks.cpp`

Supported pattern hooks:

- `factory` -> `FactoryStructuralStrategy`
- `singleton` -> `SingletonStructuralStrategy`
- `builder` -> `BuilderStructuralStrategy`
