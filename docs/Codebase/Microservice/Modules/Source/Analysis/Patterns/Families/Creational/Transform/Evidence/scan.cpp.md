# creational_transform_evidence_scan.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_evidence_scan.cpp
- Kind: C++ implementation

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis against completed class-declaration subtrees. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as scan_pattern_evidence, singleton_accessor_regex, singleton_call_regex, and builder_class_regex. It collaborates directly with internal/creational_transform_evidence_internal.hpp, regex, unordered_set, and utility.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

The flow is intentionally split into smaller slices so the major intent of creational_transform_evidence_scan.cpp stays readable. Each slice names the stage it is covering, gives a quick summary, and explains why that stage is separated from the next one.


### Program Flow Slices
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the first file-local stage for creational_transform_evidence_scan.cpp and keeps the diagram scoped to this code unit.
Why this is separate: creational_transform_evidence_scan.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Begin local flow"]
    N1["Read local input"]
    N2["Handle scan pattern evidence"]
    N3["Parse text"]
    N4["Match regex"]
    N5["Split lines"]
    N6["More local items?"]
    N7["Look up entries"]
    N8["Store local result"]
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
Quick summary: This slice shows the first local decision path for creational_transform_evidence_scan.cpp after setup.
Why this is separate: creational_transform_evidence_scan.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Return local result"]
    N1["Return from local flow"]
    N0 --> N1
```

## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after a specific class-declaration subtree exists so creational detection can evaluate that completed class.

Names worth recognizing while reading: scan_pattern_evidence, singleton_accessor_regex, singleton_call_regex, builder_class_regex, builder_step_regex, and build_method_regex.

It leans on nearby contracts or tools such as internal/creational_transform_evidence_internal.hpp, regex, unordered_set, and utility.

## Story Groups

### Reading The Input
These steps turn raw text or arguments into something the program can follow.
- scan_pattern_evidence(): Parse source text into structured values, match source text with regular expressions, and split the source into individual lines

## Function Stories

### scan_pattern_evidence()
This routine ingests source content and turns it into a more useful structured form.

Inside the body, it mainly handles parse source text into structured values, match source text with regular expressions, split the source into individual lines, and look up local indexes.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- parse source text into structured values
- match source text with regular expressions
- split the source into individual lines
- look up local indexes
- store local findings
- normalize raw text before later parsing
- fill local output fields
- read local tokens
- connect local structures
- walk the local collection
- branch on local conditions

Flow:

### Block 2 - scan_pattern_evidence() Details
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the first file-local stage for creational_transform_evidence_scan.cpp and keeps the diagram scoped to this code unit.
Why this is separate: creational_transform_evidence_scan.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["scan_pattern_evidence()"]
    N1["Handle scan pattern evidence"]
    N2["Parse text"]
    N3["Match regex"]
    N4["Split lines"]
    N5["More local items?"]
    N6["Look up entries"]
    N7["Store local result"]
    N8["Clean text"]
    N9["Populate outputs"]
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
Quick summary: This slice shows the first local decision path for creational_transform_evidence_scan.cpp after setup.
Why this is separate: creational_transform_evidence_scan.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Read structured tokens"]
    N1["Return local result"]
    N2["Return"]
    N0 --> N1
    N1 --> N2
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.

