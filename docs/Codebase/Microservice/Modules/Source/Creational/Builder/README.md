# Builder

- Folder: docs/Codebase/Microservice/Modules/Source/Creational/Builder
- Descendant source docs: 1
- Generated on: 2026-04-23

## Logic Summary
Builder-pattern specific detection logic.

## Subsystem Story
This folder is mostly leaf-level. The local documents here carry the main explanation of the subsystem without requiring much extra descent.

## Pattern Hook Role
Builder logic should act as a pattern-specific hook, not as the owner of tree assembly. The shared creational middleman should register classes, prepare common context, and attach output nodes. Builder-specific code should only decide whether a registered class has builder evidence.

```mermaid
flowchart TD
    Start["Builder hook"]
    N0["Receive class"]
    N1["Read methods"]
    N2["Check mutators"]
    N3["Check self return"]
    N4["Check build step"]
    D4{"Builder match?"}
    R4["Return none"]
    N5["Return evidence"]
    End["Middleman resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> D4
    D4 -->|yes| N5
    D4 -->|no| R4
    R4 --> End
    N5 --> End
```

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Study Creational detection docs"]
    End["Folder Exit"]
    Start --> N0
    N0 --> End
```

## Documents By Logic
### Creational Detection
These documents explain the local implementation by covering Implements creational pattern detection over the generic parse tree..
- builder_pattern_logic.cpp.md : Implements creational pattern detection over the generic parse tree.

## Reading Hint
- This folder is mostly leaf-level. Read the local file docs to understand the logic in this area.

