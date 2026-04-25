# find_class_usages_by_name.cpp

- Source document: [symbols_queries.cpp.md](../../symbols_queries.cpp.md)
- Purpose: decoupled implementation logic for a future code unit.

### find_class_usages_by_name()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles search previously collected data, inspect or register class-level information, store local findings, and fill local output fields.

The implementation iterates over a collection or repeated workload. It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- search previously collected data
- inspect or register class-level information
- store local findings
- fill local output fields
- connect local structures
- walk the local collection
- branch on local conditions

Implementation contract:
- Resolve the class name to the same class hash used by the class registry.
- Return every usage record grouped under that class hash.
- If the name cannot resolve to a class hash, return no resolved usages and leave candidate handling to the build/cross-reference stage.
- Do not scan unrelated usage buckets by partial names after a hash match is available.
- Returned usage records can include variable bindings, for example `p1` bound to the `Person` class hash.
- Member-call consumers can use those bindings to resolve `p1.speak()` to the `speak` head node under the `Person` class record.

Flow:


### Block 5 - find_class_usages_by_name() Details
#### Slice 1 - Establish Local Entry
Quick summary: This slice shows the class-name-to-usage-list query path.
Why this is separate: usage lookup should resolve the class hash first, then return the usage list for that hash.
```mermaid
flowchart TD
    N0["find_class_usages_by_name()"]
    N1["Read class name"]
    N2["Resolve class hash"]
    N3["Open binding map"]
    N4["Fetch usage list"]
    N5["Copy bindings"]
    N6["Return usages"]
    N7["No class hash"]
    N8["Return empty"]
    N0 --> N1
    N1 --> N2
    N2 -->|resolved| N3
    N3 --> N4
    N4 --> N5
    N5 --> N6
    N2 -->|unresolved| N7
    N7 --> N8
```

#### Slice 2 - Handle Early Decisions
Quick summary: This slice shows that unresolved names are not promoted into resolved usage buckets.
Why this is separate: candidate usage handling must stay separate from resolved class usage lookup.
```mermaid
flowchart TD
    N0["Name unresolved"]
    N1["Return no resolved usages"]
    N2["Leave candidate"]
    N3["Await cross-reference"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```
