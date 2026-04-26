# creational_transform_evidence_signatures.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_signatures.cpp
- Kind: C++ implementation

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis against completed class-declaration subtrees. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as collect_class_signature_lines, wanted, class_decl_regex, and collect_method_signature_lines. It collaborates directly with internal/creational_transform_evidence_internal.hpp, regex, and unordered_set.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

The flow is intentionally split into smaller slices so the major intent of creational_transform_evidence_signatures.cpp stays readable. Each slice names the stage it is covering, gives a quick summary, and explains why that stage is separated from the next one.


### Program Flow Slices
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the first file-local stage for creational_transform_evidence_signatures.cpp and keeps the diagram scoped to this code unit.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Begin local flow"]
    N1["Collect local facts"]
    N2["Collect class signature lines"]
    N3["Collect facts"]
    N4["Register classes"]
    N5["Read lines"]
    N6["More local items?"]
    N7["Match regex"]
    N8["Look up entries"]
    N9["Clean text"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Slice 2 - Handle Early Decisions
Quick summary: This slice shows the first local decision path for creational_transform_evidence_signatures.cpp after setup.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Return local result"]
    N1["Collect method signature lines"]
    N2["Collect facts"]
    N3["Read lines"]
    N4["More local items?"]
    N5["Look up entries"]
    N6["Clean text"]
    N7["Connect local nodes"]
    N8["Loop collection"]
    N9["More local items?"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Slice 3 - Hand Off Local State
Quick summary: This slice shows how creational_transform_evidence_signatures.cpp passes prepared local state into its next operation.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Return local result"]
    N1["Return from local flow"]
    N0 --> N1
```

## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

Names worth recognizing while reading: collect_class_signature_lines, wanted, class_decl_regex, and collect_method_signature_lines.

It leans on nearby contracts or tools such as internal/creational_transform_evidence_internal.hpp, regex, and unordered_set.

## Story Groups

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- collect_class_signature_lines(): Collect derived facts for later stages, inspect or register class-level information, and work one source line at a time
- collect_method_signature_lines(): Collect derived facts for later stages, work one source line at a time, and look up local indexes

## Function Stories

### collect_class_signature_lines()
This routine connects discovered items back into the broader model owned by the file.

Inside the body, it mainly handles collect derived facts for later stages, inspect or register class-level information, work one source line at a time, and match source text with regular expressions.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- collect derived facts for later stages
- inspect or register class-level information
- work one source line at a time
- match source text with regular expressions
- look up local indexes
- normalize raw text before later parsing
- connect local structures
- walk the local collection
- branch on local conditions

Flow:

### Block 2 - collect_class_signature_lines() Details
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the first file-local stage for creational_transform_evidence_signatures.cpp and keeps the diagram scoped to this code unit.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["collect_class_signature_lines()"]
    N1["Collect class signature lines"]
    N2["Collect facts"]
    N3["Register classes"]
    N4["Read lines"]
    N5["More local items?"]
    N6["Match regex"]
    N7["Look up entries"]
    N8["Clean text"]
    N9["Connect local nodes"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Slice 2 - Handle Early Decisions
Quick summary: This slice shows the first local decision path for creational_transform_evidence_signatures.cpp after setup.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Loop collection"]
    N1["More local items?"]
    N2["Return local result"]
    N3["Return"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```

### collect_method_signature_lines()
This routine connects discovered items back into the broader model owned by the file.

Inside the body, it mainly handles collect derived facts for later stages, work one source line at a time, look up local indexes, and normalize raw text before later parsing.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- collect derived facts for later stages
- work one source line at a time
- look up local indexes
- normalize raw text before later parsing
- connect local structures
- walk the local collection
- branch on local conditions

Flow:

### Block 3 - collect_method_signature_lines() Details
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the first file-local stage for creational_transform_evidence_signatures.cpp and keeps the diagram scoped to this code unit.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["collect_method_signature_lines()"]
    N1["Collect method signature lines"]
    N2["Collect facts"]
    N3["Read lines"]
    N4["More local items?"]
    N5["Look up entries"]
    N6["Clean text"]
    N7["Connect local nodes"]
    N8["Loop collection"]
    N9["More local items?"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N6 --> N7
    N7 --> N8
    N8 --> N9
```

#### Slice 2 - Handle Early Decisions
Quick summary: This slice shows the first local decision path for creational_transform_evidence_signatures.cpp after setup.
Why this is separate: creational_transform_evidence_signatures.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Check local condition"]
    N1["Continue?"]
    N2["Return early path"]
    N3["Return local result"]
    N4["Return"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

