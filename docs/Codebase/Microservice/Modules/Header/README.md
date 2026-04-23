# Header

- Folder: docs/Codebase/Microservice/Modules/Header
- Descendant source docs: 37
- Generated on: 2026-04-23

## Logic Summary
Header contracts grouped by subsystem.

## Subsystem Story
This folder mainly acts as a navigation layer. Use it to understand how the deeper child folders divide the subsystem into smaller concerns.

## Folder Flow
```mermaid
flowchart TD
    Start["Folder Entry"]
    N0["Open Behavioural interfaces folders"]
    L0{"More items?"}
    N1["Open Creational interfaces folders"]
    L1{"More items?"}
    N2["Open Syntactic interfaces folders"]
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
### Behavioural Interfaces
These child folders continue the subsystem by covering Behavioural detection interface layer..
- Behavioural/ : Behavioural detection interface layer.

### Creational Interfaces
These child folders continue the subsystem by covering Creational detection and transform interface layer..
- Creational/ : Creational detection and transform interface layer.

### Syntactic Interfaces
These child folders continue the subsystem by covering Generic parser and analysis interfaces shared across the microservice..
- SyntacticBrokenAST/ : Generic parser and analysis interfaces shared across the microservice.

## Reading Hint
- Use the child folder groups to navigate deeper into this subsystem.

