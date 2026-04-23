# creational_transform_factory_reverse_parse_mapping.cpp

- Source: Microservice/Modules/Source/Creational/Transform/creational_transform_factory_reverse_parse_mapping.cpp
- Kind: C++ implementation
- Lines: 226

## Story
### What Happens Here

This source file belongs to the older creational transform support path. It is useful for understanding previous rewrite behavior, but the current analyzer runtime focuses on tagging evidence instead of generating replacement code. This source file implements creational-pattern analysis over the generic parse tree. It inspects parsed structure, applies pattern-specific rules, and emits detector results that later appear in the creational tree or documentation tags.

### Why It Matters In The Flow

Runs after the generic parse tree exists so creational detection can label the structure.

### What To Watch While Reading

Implements creational transform dispatch, evidence rendering, and rewrite helpers. The main surface area is easiest to track through symbols such as SwitchLabel, collect_if_branch_mapping, if_condition_regex, and collect_switch_branch_mapping. It collaborates directly with internal/creational_transform_factory_reverse_internal.hpp, Transform/creational_code_generator_internal.hpp, cctype, and regex.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Finding what matters"]
    N2["Enter collect_if_branch_mapping()"]
    N3["Collect facts"]
    N4["Match regex"]
    N5["Clean text"]
    N6["Populate outputs"]
    N7["Assemble tree"]
    N8["Compute hashes"]
    N9["Leave collect_if_branch_mapping()"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Enter collect_switch_branch_mapping()"]
    N1["Collect facts"]
    N2["Match regex"]
    N3["Look up entries"]
    N4["Record output"]
    N5["Clean text"]
    N6["Populate outputs"]
    N7["Return result"]
    N8["Enter collect_top_level_default_return()"]
    N9["Collect facts"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Look up entries"]
    N1["Clean text"]
    N2["Populate outputs"]
    N3["Assemble tree"]
    N4["Compute hashes"]
    N5["Return result"]
    N6["End"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
```

## Reading Map
Read this file as: Implements creational transform dispatch, evidence rendering, and rewrite helpers.

Where it sits in the run: Runs after the generic parse tree exists so creational detection can label the structure.

Names worth recognizing while reading: SwitchLabel, collect_if_branch_mapping, if_condition_regex, collect_switch_branch_mapping, switch_regex, and label_regex.

It leans on nearby contracts or tools such as internal/creational_transform_factory_reverse_internal.hpp, Transform/creational_code_generator_internal.hpp, cctype, regex, string, and vector.

## Story Groups

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- collect_if_branch_mapping() (line 11): Collect derived facts for later stages, match source text with regular expressions, and normalize raw text before later parsing
- collect_switch_branch_mapping() (line 56): Collect derived facts for later stages, match source text with regular expressions, and look up entries in previously collected maps or sets
- collect_top_level_default_return() (line 168): Collect derived facts for later stages, look up entries in previously collected maps or sets, and normalize raw text before later parsing

## Function Stories

### collect_if_branch_mapping()
This routine connects discovered items back into the broader model owned by the file. It appears near line 11.

Inside the body, it mainly handles collect derived facts for later stages, match source text with regular expressions, normalize raw text before later parsing, and populate output fields or accumulators.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path.

What it does:
- collect derived facts for later stages
- match source text with regular expressions
- normalize raw text before later parsing
- populate output fields or accumulators
- assemble tree or artifact structures
- compute hash metadata
- iterate over the active collection
- branch on runtime conditions

Flow:

### Block 2 - collect_if_branch_mapping() Details
#### Part 1
```mermaid
flowchart TD
    N0["collect_if_branch_mapping()"]
    N1["Enter collect_if_branch_mapping()"]
    N2["Collect facts"]
    N3["Match regex"]
    N4["Clean text"]
    N5["Populate outputs"]
    N6["Assemble tree"]
    N7["Compute hashes"]
    N8["Loop collection"]
    N9["More items?"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Hand back"]
    N4["Return"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```

### collect_switch_branch_mapping()
This routine connects discovered items back into the broader model owned by the file. It appears near line 56.

Inside the body, it mainly handles collect derived facts for later stages, match source text with regular expressions, look up entries in previously collected maps or sets, and record derived output into collections.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- collect derived facts for later stages
- match source text with regular expressions
- look up entries in previously collected maps or sets
- record derived output into collections
- normalize raw text before later parsing
- populate output fields or accumulators
- assemble tree or artifact structures
- compute hash metadata
- iterate over the active collection
- branch on runtime conditions

Flow:

### Block 3 - collect_switch_branch_mapping() Details
#### Part 1
```mermaid
flowchart TD
    N0["collect_switch_branch_mapping()"]
    N1["Enter collect_switch_branch_mapping()"]
    N2["Collect facts"]
    N3["Match regex"]
    N4["Look up entries"]
    N5["Record output"]
    N6["Clean text"]
    N7["Populate outputs"]
    N8["Assemble tree"]
    N9["Compute hashes"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Return result"]
    N1["Return"]
    N0 --> N1
```

### collect_top_level_default_return()
This routine connects discovered items back into the broader model owned by the file. It appears near line 168.

Inside the body, it mainly handles collect derived facts for later stages, look up entries in previously collected maps or sets, normalize raw text before later parsing, and populate output fields or accumulators.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- collect derived facts for later stages
- look up entries in previously collected maps or sets
- normalize raw text before later parsing
- populate output fields or accumulators
- assemble tree or artifact structures
- compute hash metadata
- iterate over the active collection
- branch on runtime conditions

Flow:

### Block 4 - collect_top_level_default_return() Details
#### Part 1
```mermaid
flowchart TD
    N0["collect_top_level_default_return()"]
    N1["Enter collect_top_level_default_return()"]
    N2["Collect facts"]
    N3["Look up entries"]
    N4["Clean text"]
    N5["Populate outputs"]
    N6["Assemble tree"]
    N7["Compute hashes"]
    N8["Loop collection"]
    N9["More items?"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Return result"]
    N4["Return"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.
