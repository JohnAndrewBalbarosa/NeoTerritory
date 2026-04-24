# pattern_tree_assembler.cpp

## Role
Builds the returned tree from hook evidence. Hooks do not assemble the final tree.

## Intended Source Role
This file maps to the future tree assembler. It is the only module allowed to create the final pattern tree shape.

## Assembly Flow
```mermaid
flowchart TD
    Start["Hook results"]
    N0["Create root"]
    N1["Read evidence"]
    N2["Create subtree"]
    N3["Attach subtree"]
    N4["Finalize root"]
    End["Tree ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Empty Flow
```mermaid
flowchart TD
    Start["Finalize root"]
    D0{"Has child?"}
    N0["Keep tree"]
    N1["Set empty label"]
    N2["Return tree"]
    End["Done"]
    Start --> D0
    D0 -->|yes| N0
    D0 -->|no| N1
    N0 --> N2
    N1 --> N2
    N2 --> End
```

## Node Shape
- Family root.
- Pattern node.
- Target class node.
- Evidence node.
- Related symbol node.
- Diagnostic node.

## Evidence Flow
```mermaid
flowchart TD
    Start["Evidence"]
    N0["Group pattern"]
    N1["Create node"]
    N2["Attach target"]
    N3["Attach details"]
    End["Subtree ready"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Ordering Rule
Assembler should sort or preserve records in one place. Pattern hooks should not decide final output ordering.
