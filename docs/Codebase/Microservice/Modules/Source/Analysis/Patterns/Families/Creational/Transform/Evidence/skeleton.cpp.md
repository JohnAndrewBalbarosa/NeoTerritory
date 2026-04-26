# creational_transform_evidence_skeleton.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_skeleton.cpp
- Kind: C++ implementation

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis against completed class-declaration subtrees. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as build_source_type_skeleton_lines, build_target_type_skeleton_lines, build_source_callsite_skeleton_lines, and build_target_callsite_skeleton_lines. It collaborates directly with internal/creational_transform_evidence_internal.hpp and sstream.

## Program Flow
Quick summary: this diagram shows the file-local activity path for this implementation unit. It stays inside this code file and uses only entry and return boundaries as external references.

Why this slice is separate: deeper helper docs can explain individual functions, while this file still needs to show the main activity path in place.

```mermaid
flowchart TD
    N0["Receive local input"]
    N1["Check monolithic structure"]
    N2["Create source type skeleton lines"]
    N3["Create target type skeleton lines"]
    N4["Create source callsite skeleton lines"]
    N5["Create target callsite skeleton lines"]
    N6["Return local result"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
```

Detailed program flow is decoupled into future implementation units:

- [program_flow](./SkeletonFlow/creational_transform_evidence_skeleton_program_flow.cpp.md)
## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

Names worth recognizing while reading: build_source_type_skeleton_lines, build_target_type_skeleton_lines, build_source_callsite_skeleton_lines, build_target_callsite_skeleton_lines, and validate_monolithic_structure.

It leans on nearby contracts or tools such as internal/creational_transform_evidence_internal.hpp and sstream.

## Story Groups

### Checks Before Moving On
These steps stop bad input or unsupported state before it can confuse the next part of the run.
- validate_monolithic_structure(): Validate assumptions before continuing, look up local indexes, and normalize raw text before later parsing

### Building The Working Picture
These steps assemble the trees, models, or bundles used by the rest of the file.
- build_source_type_skeleton_lines(): Create the local output structure, work one source line at a time, and store local findings
- build_target_type_skeleton_lines(): Create the local output structure, work one source line at a time, and store local findings
- build_source_callsite_skeleton_lines(): Create the local output structure, work one source line at a time, and recognize or rewrite callsite structure
- build_target_callsite_skeleton_lines(): Create the local output structure, work one source line at a time, and recognize or rewrite callsite structure

## Function Stories
Function-level logic is decoupled into future implementation units:

- [build_source_type_skeleton_lines](./SkeletonFlow/functions/build_source_type_skeleton_lines.cpp.md)
- [build_target_type_skeleton_lines](./SkeletonFlow/functions/build_target_type_skeleton_lines.cpp.md)
- [build_source_callsite_skeleton_lines](./SkeletonFlow/functions/build_source_callsite_skeleton_lines.cpp.md)
- [build_target_callsite_skeleton_lines](./SkeletonFlow/functions/build_target_callsite_skeleton_lines.cpp.md)
- [validate_monolithic_structure](./SkeletonFlow/functions/validate_monolithic_structure.cpp.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.