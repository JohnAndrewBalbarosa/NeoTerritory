# creational_transform_rules.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_rules.cpp
- Kind: C++ implementation
- Lines: 543

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after the generic parse tree exists so creational detection can label the structure.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as ConfigMethodModel, ClassBuilderModel, TransformRule, and derive_field_base_name. It collaborates directly with Transform/creational_code_generator_internal.hpp, Transform/creational_transform_factory_reverse.hpp, parse_tree_symbols.hpp, and cctype.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow](./creational_transform_rules/creational_transform_rules_program_flow.cpp.md)
## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after the generic parse tree exists so creational detection can label the structure.

Names worth recognizing while reading: ConfigMethodModel, ClassBuilderModel, TransformRule, derive_field_base_name, collect_config_methods_for_class, and generate_builder_class_code.

It leans on nearby contracts or tools such as Transform/creational_code_generator_internal.hpp, Transform/creational_transform_factory_reverse.hpp, parse_tree_symbols.hpp, cctype, regex, and sstream.

## Story Groups

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- collect_config_methods_for_class() (line 72): Collect derived facts for later stages, inspect or register class-level information, and look up entries in previously collected maps or sets

### Building The Working Picture
These steps assemble the trees, models, or bundles used by the rest of the file.
- derive_field_base_name() (line 32): Record derived output into collections, normalize raw text before later parsing, and assemble tree or artifact structures
- inject_builder_class() (line 230): Inspect or register class-level information, match source text with regular expressions, and split the source into individual lines
- rewrite_simple_singleton_callsite_to_builder() (line 275): Rewrite source text or model state, recognize or rewrite callsite structure, and match source text with regular expressions
- transform_to_singleton_by_class_references() (line 345): Rewrite source text or model state, inspect or register class-level information, and look up entries in previously collected maps or sets
- transform_singleton_to_builder() (line 402): Rewrite source text or model state, look up entries in previously collected maps or sets, and record derived output into collections

### Changing Or Cleaning The Picture
These steps adjust existing state or remove stale pieces after better information is available.
- transform_factory_to_base() (line 388): Rewrite source text or model state and handle factory-specific detection or rewrite logic
- transform_rules() (line 503): Rewrite source text or model state
- transform_using_registered_rule() (line 513): Rewrite source text or model state, iterate over the active collection, and branch on runtime conditions

### Supporting Steps
These steps support the local behavior of the file.
- generate_builder_class_code() (line 177): Inspect or register class-level information, populate output fields or accumulators, and serialize report content
- pattern_matches() (line 497): Owns a focused local responsibility.

## Function Stories
Function-level logic is decoupled into future implementation units:

- [derive_field_base_name](./creational_transform_rules/functions/derive_field_base_name.cpp.md)
- [collect_config_methods_for_class](./creational_transform_rules/functions/collect_config_methods_for_class.cpp.md)
- [generate_builder_class_code](./creational_transform_rules/functions/generate_builder_class_code.cpp.md)
- [inject_builder_class](./creational_transform_rules/functions/inject_builder_class.cpp.md)
- [rewrite_simple_singleton_callsite_to_builder](./creational_transform_rules/functions/rewrite_simple_singleton_callsite_to_builder.cpp.md)
- [transform_to_singleton_by_class_references](./creational_transform_rules/functions/transform_to_singleton_by_class_references.cpp.md)
- [transform_factory_to_base](./creational_transform_rules/functions/transform_factory_to_base.cpp.md)
- [transform_singleton_to_builder](./creational_transform_rules/functions/transform_singleton_to_builder.cpp.md)
- [pattern_matches](./creational_transform_rules/functions/pattern_matches.cpp.md)
- [transform_rules](./creational_transform_rules/functions/transform_rules.cpp.md)
- [transform_using_registered_rule](./creational_transform_rules/functions/transform_using_registered_rule.cpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.