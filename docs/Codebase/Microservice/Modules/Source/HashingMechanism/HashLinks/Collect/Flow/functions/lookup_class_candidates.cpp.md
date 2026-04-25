# lookup_class_candidates.cpp

- Source document: [hash_links_collect.cpp.md](../../hash_links_collect.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### lookup_class_candidates()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles search previously collected data, inspect or register class-level information, look up local indexes, and compute hash metadata.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- search previously collected data
- inspect or register class-level information
- look up local indexes
- compute hash metadata
- branch on local conditions

Implementation contract:
- Class candidate lookup should resolve to a class registry head record.
- Use class name plus file context when the same class name can exist in multiple files.
- The hash-link path may include child hashes, but those child hashes only help locate nested evidence under the class head.
- Do not return a child node as the class registry pointer target.

Flow:


### Block 4 - lookup_class_candidates() Details
#### Slice 1 - Establish Local Entry
Quick summary: This slice resolves class candidates to class head records while keeping child hashes as path evidence.
Why this is separate: class lookup must not confuse nested evidence with registry ownership.
```mermaid
flowchart TD
    N0["lookup_class_candidates()"]
    N1["Read class candidate"]
    N2["Apply file context"]
    N3["Find class head"]
    N4["Read path evidence"]
    N5["Check identity"]
    N6["Return class record"]
    N7["Collision?"]
    N8["Report diagnostic"]
    N9["Return none"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 -->|match| N6
    N5 -->|collision| N7
    N7 --> N8
    N5 -->|missing| N9
```

#### Slice 2 - Handle Early Decisions
Quick summary: This slice shows the first local decision path for lookup_class_candidates.cpp after setup.
Why this is separate: lookup_class_candidates.cpp has multiple branches, loops, or stage changes, so this section is split out to keep one major intent visible at a time instead of forcing one oversized diagram.
```mermaid
flowchart TD
    N0["Return"]
```

