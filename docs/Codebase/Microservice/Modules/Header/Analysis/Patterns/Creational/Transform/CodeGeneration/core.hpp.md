# creational_code_generator_internal.hpp

- Source: Microservice/Modules/Header/Creational/Transform/creational_code_generator_internal.hpp
- Kind: C++ header

## Story
### What Happens Here

This header implements the compile-time contract for the creational subsystem. It declares the detectors, transforms, and helper types that the runtime sources later define.

### Why It Matters In The Flow

This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

### What To Watch While Reading

Declares creational-pattern detection and transform interfaces. The main surface area is easiest to track through symbols such as lower, trim, split_words, and starts_with. It collaborates directly with parse_tree.hpp, parse_tree_code_generator.hpp, Singleton/singleton_pattern_logic.hpp, and cstddef.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow_01](./creational_code_generator_internal/creational_code_generator_internal_program_flow_01.hpp.md)
- [program_flow_02](./creational_code_generator_internal/creational_code_generator_internal_program_flow_02.hpp.md)
## Reading Map
Read this file as: Declares creational-pattern detection and transform interfaces.

Where it sits in the run: This artifact participates in the repository flow according to the surrounding module or toolchain that loads it.

Names worth recognizing while reading: lower, trim, split_words, starts_with, find_matching_brace, and is_class_block.

It leans on nearby contracts or tools such as parse_tree.hpp, parse_tree_code_generator.hpp, Singleton/singleton_pattern_logic.hpp, cstddef, regex, and string.

## Story Groups

### Promises This File Makes
These entries tell the rest of the program what this file can provide.
- lower(): Declare a callable contract and let implementation files define the runtime body
- trim(): Declare a callable contract and let implementation files define the runtime body
- split_words(): Declare a callable contract and let implementation files define the runtime body
- starts_with(): Declare a callable contract and let implementation files define the runtime body
- find_matching_brace(): Declare a callable contract and let implementation files define the runtime body
- is_class_block(): Declare a callable contract and let implementation files define the runtime body
- is_function_block(): Declare a callable contract and let implementation files define the runtime body
- class_name_from_signature(): Declare a callable contract and let implementation files define the runtime body
- function_name_from_signature(): Declare a callable contract and let implementation files define the runtime body
- inject_singleton_accessor(): Declare a callable contract and let implementation files define the runtime body
- rewrite_class_instantiations_to_singleton_references(): Declare a callable contract and let implementation files define the runtime body
- extract_crucial_class_names(): Declare a callable contract and let implementation files define the runtime body
- ensure_decision(): Declare a callable contract and let implementation files define the runtime body
- add_reason_if_missing(): Declare a callable contract and let implementation files define the runtime body
- split_lines(): Declare a callable contract and let implementation files define the runtime body
- join_lines(): Declare a callable contract and let implementation files define the runtime body
- is_config_method_name(): Declare a callable contract and let implementation files define the runtime body
- is_monolithic_config_method_name(): Declare a callable contract and let implementation files define the runtime body
- is_monolithic_build_method_name(): Declare a callable contract and let implementation files define the runtime body
- is_build_method_name(): Declare a callable contract and let implementation files define the runtime body
- is_operational_method_name(): Declare a callable contract and let implementation files define the runtime body
- ends_with(): Declare a callable contract and let implementation files define the runtime body
- strip_builder_suffix(): Declare a callable contract and let implementation files define the runtime body
- append_unique_token(): Declare a callable contract and let implementation files define the runtime body
- append_unique_line(): Declare a callable contract and let implementation files define the runtime body
- append_unique_lines(): Declare a callable contract and let implementation files define the runtime body
- regex_capture_or_empty(): Declare a callable contract and let implementation files define the runtime body
- build_monolithic_evidence_view(): Declare a callable contract and let implementation files define the runtime body
- transform_to_singleton_by_class_references(): Declare a callable contract and let implementation files define the runtime body
- transform_singleton_to_builder(): Declare a callable contract and let implementation files define the runtime body
- transform_using_registered_rule(): Declare a callable contract and let implementation files define the runtime body

## Function Stories
Function-level logic is decoupled into future implementation units:

- [lower](./creational_code_generator_internal/functions/lower.hpp.md)
- [trim](./creational_code_generator_internal/functions/trim.hpp.md)
- [split_words](./creational_code_generator_internal/functions/split_words.hpp.md)
- [starts_with](./creational_code_generator_internal/functions/starts_with.hpp.md)
- [find_matching_brace](./creational_code_generator_internal/functions/find_matching_brace.hpp.md)
- [is_class_block](./creational_code_generator_internal/functions/is_class_block.hpp.md)
- [is_function_block](./creational_code_generator_internal/functions/is_function_block.hpp.md)
- [class_name_from_signature](./creational_code_generator_internal/functions/class_name_from_signature.hpp.md)
- [function_name_from_signature](./creational_code_generator_internal/functions/function_name_from_signature.hpp.md)
- [inject_singleton_accessor](./creational_code_generator_internal/functions/inject_singleton_accessor.hpp.md)
- [rewrite_class_instantiations_to_singleton_references](./creational_code_generator_internal/functions/rewrite_class_instantiations_to_singleton_references.hpp.md)
- [extract_crucial_class_names](./creational_code_generator_internal/functions/extract_crucial_class_names.hpp.md)
- [ensure_decision](./creational_code_generator_internal/functions/ensure_decision.hpp.md)
- [add_reason_if_missing](./creational_code_generator_internal/functions/add_reason_if_missing.hpp.md)
- [split_lines](./creational_code_generator_internal/functions/split_lines.hpp.md)
- [join_lines](./creational_code_generator_internal/functions/join_lines.hpp.md)
- [is_config_method_name](./creational_code_generator_internal/functions/is_config_method_name.hpp.md)
- [is_monolithic_config_method_name](./creational_code_generator_internal/functions/is_monolithic_config_method_name.hpp.md)
- [is_monolithic_build_method_name](./creational_code_generator_internal/functions/is_monolithic_build_method_name.hpp.md)
- [is_build_method_name](./creational_code_generator_internal/functions/is_build_method_name.hpp.md)
- [is_operational_method_name](./creational_code_generator_internal/functions/is_operational_method_name.hpp.md)
- [ends_with](./creational_code_generator_internal/functions/ends_with.hpp.md)
- [strip_builder_suffix](./creational_code_generator_internal/functions/strip_builder_suffix.hpp.md)
- [append_unique_token](./creational_code_generator_internal/functions/append_unique_token.hpp.md)
- [append_unique_line](./creational_code_generator_internal/functions/append_unique_line.hpp.md)
- [append_unique_lines](./creational_code_generator_internal/functions/append_unique_lines.hpp.md)
- [regex_capture_or_empty](./creational_code_generator_internal/functions/regex_capture_or_empty.hpp.md)
- [build_monolithic_evidence_view](./creational_code_generator_internal/functions/build_monolithic_evidence_view.hpp.md)
- [transform_to_singleton_by_class_references](./creational_code_generator_internal/functions/transform_to_singleton_by_class_references.hpp.md)
- [transform_singleton_to_builder](./creational_code_generator_internal/functions/transform_singleton_to_builder.hpp.md)
- [transform_using_registered_rule](./creational_code_generator_internal/functions/transform_using_registered_rule.hpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.