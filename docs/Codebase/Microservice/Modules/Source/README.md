# Source

- Folder: docs/Codebase/Microservice/Modules/Source
- Descendant source docs: 55
- Generated on: 2026-04-23

## Logic Summary
C++ source implementations grouped by subsystem.

## Subsystem Story
This folder mainly acts as a navigation layer. Use it to understand how the deeper child folders divide the subsystem into smaller concerns.

## Architecture Notes
The Behavioural and Creational source areas should use a shared middleman for tree assembly and class registration. Read [README.md](./PatternMiddlemanArchitecture/README.md) before changing pattern detection docs or code.

```mermaid
flowchart TD
    Start["Source entry"]
    N0["Read architecture"]
    N1["Open middleman docs"]
    N2["Review Behavioural flow"]
    N3["Review Creational flow"]
    N4["Apply hook boundary"]
    End["Continue reading"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Open Behavioural detection folders"]
    L0{"More items?"}
    N1["Open Creational detection folders"]
    L1{"More items?"}
    N2["Open Syntactic pipeline folders"]
    L2{"More items?"}
    End["Folder Exit"]
    Start --> N0
    N0 --> L0
    L0 -->|more| N0
    L0 -->|done| N1
    N1 --> L1
    L1 -->|more| N1
    L1 -->|done| N2
    N2 --> L2
    L2 -->|more| N2
    L2 -->|done| End
```

## Child Folders By Logic
### Behavioural Detection
These child folders continue the subsystem by covering Behavioural pattern detection implementation..
- Behavioural/ : Behavioural pattern detection implementation.

### Creational Detection
These child folders continue the subsystem by covering Creational pattern detection over the generic parse tree..
- Creational/ : Creational pattern detection over the generic parse tree.

### Pattern Middleman Architecture
These documents define the required shared middleman flow for Behavioural and Creational tree assembly.
- PatternMiddlemanArchitecture/ : Shared architecture notes for class registration, tree assembly, and virtual pattern hooks.

### Syntactic Pipeline
These child folders continue the subsystem by covering Generic syntactic pipeline services such as CLI parsing, source reading, lexical hooks, documentation tagging, and reporting..
- SyntacticBrokenAST/ : Generic syntactic pipeline services such as CLI parsing, source reading, lexical hooks, documentation tagging, and reporting.

## Reading Hint
- Use the child folder groups to navigate deeper into this subsystem.

