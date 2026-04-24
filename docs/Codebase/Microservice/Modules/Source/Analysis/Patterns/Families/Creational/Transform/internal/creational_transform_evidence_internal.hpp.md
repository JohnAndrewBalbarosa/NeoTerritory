# creational_transform_evidence_internal.hpp

- Source: Microservice/Modules/Source/Creational/Transform/internal/creational_transform_evidence_internal.hpp
- Kind: C++ header

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after the generic parse tree exists so creational detection can label the structure.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as SingletonCallsiteEvidence, EvidenceScanResult, MonolithicClassView, and collect_class_signature_lines. It collaborates directly with Transform/creational_code_generator_internal.hpp, sstream, string, and vector.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow](./creational_transform_evidence_internal/creational_transform_evidence_internal_program_flow.cpp.md)
## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after the generic parse tree exists so creational detection can label the structure.

Names worth recognizing while reading: SingletonCallsiteEvidence, EvidenceScanResult, MonolithicClassView, collect_class_signature_lines, collect_method_signature_lines, and brace_delta.

It leans on nearby contracts or tools such as Transform/creational_code_generator_internal.hpp, sstream, string, and vector.

## Story Groups

### Promises This File Makes
These entries tell the rest of the program what this file can provide.
- SingletonCallsiteEvidence: Declare a shared type and expose the compile-time contract
- EvidenceScanResult: Declare a shared type and expose the compile-time contract
- MonolithicClassView: Declare a shared type and expose the compile-time contract
- collect_class_signature_lines(): Declare a callable contract and let implementation files define the runtime body
- collect_method_signature_lines(): Declare a callable contract and let implementation files define the runtime body
- brace_delta(): Declare a callable contract and let implementation files define the runtime body
- retain_single_main_function(): Declare a callable contract and let implementation files define the runtime body
- scan_pattern_evidence(): Declare a callable contract and let implementation files define the runtime body
- ensure_class_view(): Declare a callable contract and let implementation files define the runtime body
- method_name_from_chain_call(): Declare a callable contract and let implementation files define the runtime body
- build_class_views(): Declare a callable contract and let implementation files define the runtime body
- build_source_evidence_present_lines(): Declare a callable contract and let implementation files define the runtime body
- build_target_evidence_removed_lines(): Declare a callable contract and let implementation files define the runtime body
- build_target_evidence_added_lines(): Declare a callable contract and let implementation files define the runtime body
- build_source_type_skeleton_lines(): Declare a callable contract and let implementation files define the runtime body
- build_target_type_skeleton_lines(): Declare a callable contract and let implementation files define the runtime body
- build_source_callsite_skeleton_lines(): Declare a callable contract and let implementation files define the runtime body
- build_target_callsite_skeleton_lines(): Declare a callable contract and let implementation files define the runtime body
- validate_monolithic_structure(): Declare a callable contract and let implementation files define the runtime body
- append_evidence_section(): Declare a callable contract and let implementation files define the runtime body
- append_code_section(): Declare a callable contract and let implementation files define the runtime body

## Function Stories
Function-level logic is decoupled into future implementation units:

- [singletoncallsiteevidence](./creational_transform_evidence_internal/functions/singletoncallsiteevidence.cpp.md)
- [evidencescanresult](./creational_transform_evidence_internal/functions/evidencescanresult.cpp.md)
- [monolithicclassview](./creational_transform_evidence_internal/functions/monolithicclassview.cpp.md)
- [collect_class_signature_lines](./creational_transform_evidence_internal/functions/collect_class_signature_lines.cpp.md)
- [collect_method_signature_lines](./creational_transform_evidence_internal/functions/collect_method_signature_lines.cpp.md)
- [brace_delta](./creational_transform_evidence_internal/functions/brace_delta.cpp.md)
- [retain_single_main_function](./creational_transform_evidence_internal/functions/retain_single_main_function.cpp.md)
- [scan_pattern_evidence](./creational_transform_evidence_internal/functions/scan_pattern_evidence.cpp.md)
- [ensure_class_view](./creational_transform_evidence_internal/functions/ensure_class_view.cpp.md)
- [method_name_from_chain_call](./creational_transform_evidence_internal/functions/method_name_from_chain_call.cpp.md)
- [build_class_views](./creational_transform_evidence_internal/functions/build_class_views.cpp.md)
- [build_source_evidence_present_lines](./creational_transform_evidence_internal/functions/build_source_evidence_present_lines.cpp.md)
- [build_target_evidence_removed_lines](./creational_transform_evidence_internal/functions/build_target_evidence_removed_lines.cpp.md)
- [build_target_evidence_added_lines](./creational_transform_evidence_internal/functions/build_target_evidence_added_lines.cpp.md)
- [build_source_type_skeleton_lines](./creational_transform_evidence_internal/functions/build_source_type_skeleton_lines.cpp.md)
- [build_target_type_skeleton_lines](./creational_transform_evidence_internal/functions/build_target_type_skeleton_lines.cpp.md)
- [build_source_callsite_skeleton_lines](./creational_transform_evidence_internal/functions/build_source_callsite_skeleton_lines.cpp.md)
- [build_target_callsite_skeleton_lines](./creational_transform_evidence_internal/functions/build_target_callsite_skeleton_lines.cpp.md)
- [validate_monolithic_structure](./creational_transform_evidence_internal/functions/validate_monolithic_structure.cpp.md)
- [append_evidence_section](./creational_transform_evidence_internal/functions/append_evidence_section.cpp.md)
- [append_code_section](./creational_transform_evidence_internal/functions/append_code_section.cpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.