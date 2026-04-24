# creational_code_generator_internal.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_code_generator_internal.cpp
- Kind: C++ implementation
- Lines: 494

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after the generic parse tree exists so creational detection can label the structure.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as lower, lowercase_ascii, trim, and split_words. It collaborates directly with Transform/creational_code_generator_internal.hpp, Language-and-Structure/language_tokens.hpp, cctype, and regex.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow_01](./creational_code_generator_internal/creational_code_generator_internal_program_flow_01.cpp.md)
- [program_flow_02](./creational_code_generator_internal/creational_code_generator_internal_program_flow_02.cpp.md)
- [program_flow_03](./creational_code_generator_internal/creational_code_generator_internal_program_flow_03.cpp.md)
## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after the generic parse tree exists so creational detection can label the structure.

Names worth recognizing while reading: lower, lowercase_ascii, trim, split_words, starts_with, and find_matching_brace.

It leans on nearby contracts or tools such as Transform/creational_code_generator_internal.hpp, Language-and-Structure/language_tokens.hpp, cctype, regex, sstream, and string.

## Story Groups

### Small Preparation Steps
These steps clean up names, text, or small values before the larger work begins.
- trim() (line 21): Normalize or format text values, normalize raw text before later parsing, and iterate over the active collection
- split_words() (line 38): Split source text into smaller units, record derived output into collections, and assemble tree or artifact structures
- split_lines() (line 299): Split source text into smaller units, work one source line at a time, and record derived output into collections
- join_lines() (line 320): Work one source line at a time, populate output fields or accumulators, and serialize report content

### Checks Before Moving On
These steps stop bad input or unsupported state before it can confuse the next part of the run.
- is_class_block() (line 96): Inspect or register class-level information, normalize raw text before later parsing, and iterate over the active collection
- is_function_block() (line 115): Look up entries in previously collected maps or sets, normalize raw text before later parsing, and branch on runtime conditions
- ensure_decision() (line 271): Validate assumptions before continuing, look up entries in previously collected maps or sets, and record derived output into collections
- is_config_method_name() (line 385): Owns a focused local responsibility.
- is_monolithic_config_method_name() (line 395): Owns a focused local responsibility.
- is_monolithic_build_method_name() (line 404): Owns a focused local responsibility.
- is_build_method_name() (line 414): Owns a focused local responsibility.
- is_operational_method_name() (line 424): Assemble tree or artifact structures

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- find_matching_brace() (line 69): Search previously collected data

### Building The Working Picture
These steps assemble the trees, models, or bundles used by the rest of the file.
- inject_singleton_accessor() (line 171): Match source text with regular expressions, split the source into individual lines, and reassemble token or line collections into text
- extract_crucial_class_names() (line 240): Inspect or register class-level information, record derived output into collections, and parse or tokenize input text
- add_reason_if_missing() (line 287): Build or append the next output structure, record derived output into collections, and assemble tree or artifact structures
- append_unique_token() (line 447): Record derived output into collections, populate output fields or accumulators, and assemble tree or artifact structures
- append_unique_line() (line 463): Work one source line at a time, normalize raw text before later parsing, and assemble tree or artifact structures
- append_unique_lines() (line 473): Work one source line at a time, assemble tree or artifact structures, and iterate over the active collection

### Changing Or Cleaning The Picture
These steps adjust existing state or remove stale pieces after better information is available.
- rewrite_class_instantiations_to_singleton_references() (line 222): Rewrite source text or model state, inspect or register class-level information, and match source text with regular expressions

### Main Path
These steps drive the main execution path by calling the supporting work in order.
- starts_with() (line 64): Drive the main execution path

### Supporting Steps
These steps support the local behavior of the file.
- lower() (line 16): Owns a focused local responsibility.
- class_name_from_signature() (line 139): Inspect or register class-level information, iterate over the active collection, and branch on runtime conditions
- function_name_from_signature() (line 153): Look up entries in previously collected maps or sets, normalize raw text before later parsing, and branch on runtime conditions
- ends_with() (line 432): Owns a focused local responsibility.
- strip_builder_suffix() (line 438): Normalize raw text before later parsing and branch on runtime conditions
- regex_capture_or_empty() (line 481): Branch on runtime conditions

## Function Stories
Function-level logic is decoupled into future implementation units:

- [lower](./creational_code_generator_internal/functions/lower.cpp.md)
- [trim](./creational_code_generator_internal/functions/trim.cpp.md)
- [split_words](./creational_code_generator_internal/functions/split_words.cpp.md)
- [starts_with](./creational_code_generator_internal/functions/starts_with.cpp.md)
- [find_matching_brace](./creational_code_generator_internal/functions/find_matching_brace.cpp.md)
- [is_class_block](./creational_code_generator_internal/functions/is_class_block.cpp.md)
- [is_function_block](./creational_code_generator_internal/functions/is_function_block.cpp.md)
- [class_name_from_signature](./creational_code_generator_internal/functions/class_name_from_signature.cpp.md)
- [function_name_from_signature](./creational_code_generator_internal/functions/function_name_from_signature.cpp.md)
- [inject_singleton_accessor](./creational_code_generator_internal/functions/inject_singleton_accessor.cpp.md)
- [rewrite_class_instantiations_to_singleton_references](./creational_code_generator_internal/functions/rewrite_class_instantiations_to_singleton_references.cpp.md)
- [extract_crucial_class_names](./creational_code_generator_internal/functions/extract_crucial_class_names.cpp.md)
- [ensure_decision](./creational_code_generator_internal/functions/ensure_decision.cpp.md)
- [add_reason_if_missing](./creational_code_generator_internal/functions/add_reason_if_missing.cpp.md)
- [split_lines](./creational_code_generator_internal/functions/split_lines.cpp.md)
- [join_lines](./creational_code_generator_internal/functions/join_lines.cpp.md)
- [is_config_method_name](./creational_code_generator_internal/functions/is_config_method_name.cpp.md)
- [is_monolithic_config_method_name](./creational_code_generator_internal/functions/is_monolithic_config_method_name.cpp.md)
- [is_monolithic_build_method_name](./creational_code_generator_internal/functions/is_monolithic_build_method_name.cpp.md)
- [is_build_method_name](./creational_code_generator_internal/functions/is_build_method_name.cpp.md)
- [is_operational_method_name](./creational_code_generator_internal/functions/is_operational_method_name.cpp.md)
- [ends_with](./creational_code_generator_internal/functions/ends_with.cpp.md)
- [strip_builder_suffix](./creational_code_generator_internal/functions/strip_builder_suffix.cpp.md)
- [append_unique_token](./creational_code_generator_internal/functions/append_unique_token.cpp.md)
- [append_unique_line](./creational_code_generator_internal/functions/append_unique_line.cpp.md)
- [append_unique_lines](./creational_code_generator_internal/functions/append_unique_lines.cpp.md)
- [regex_capture_or_empty](./creational_code_generator_internal/functions/regex_capture_or_empty.cpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.