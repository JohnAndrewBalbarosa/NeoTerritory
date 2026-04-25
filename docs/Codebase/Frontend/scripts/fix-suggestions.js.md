# fix-suggestions.js

- Source: Frontend/scripts/fix-suggestions.js
- Kind: JavaScript module

## Story
### What Happens Here

This script renders fix candidates, validation checks, and applied-state presentation from backend or microservice output. It owns display state only; it must not define transform rules or decide which pattern migration is correct.

### Why It Matters In The Flow

Runs after a transform job reports suggestions or generated changes. It helps the user inspect what the microservice recommends before downloading output.

### What To Watch While Reading

Keep suggested fixes traceable to the microservice report. UI counters and cards should summarize returned data, not replace backend validation.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Slice 1 - Continue Local Flow
```mermaid
flowchart TD
    N0["Open fixes"]
    N1["Load report"]
    N2["Render cards"]
    N3["Render checks"]
    N4["Validate data"]
    N5["Has fixes?"]
    N6["Show empty"]
    N7["Update counts"]
    N8["Track applied"]
    N9["Enable download"]
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

#### Slice 2 - Continue Local Flow
```mermaid
flowchart TD
    N0["Toggle fix"]
    N1["Update state"]
    N2["Count applied"]
    N3["Refresh cards"]
    N4["Refresh checks"]
    N5["Preserve report"]
    N6["Await action"]
    N7["Update counts"]
    N8["Validate DOM"]
    N9["Continue?"]
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

#### Slice 3 - Continue Local Flow
```mermaid
flowchart TD
    N0["Missing DOM"]
    N1["Skip update"]
    N2["Return helper"]
    N3["End view"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```

## Reading Map
Read this file as: Renders microservice-provided fix candidates and validation checks.

Where it sits in the run: Runs after analysis results are available and before output download.

Names worth recognizing while reading: renderFixCards, renderChecklist, updateCounts, fixes, checklist, and appliedSet.

## Story Groups

### Showing The Result
These steps turn internal state into text, HTML, JSON, or another output a reader can inspect.
- renderFixCards(): Render or serialize the result, validate conditions and branch on failures, and update DOM state
- renderChecklist(): Render or serialize the result, validate conditions and branch on failures, and update DOM state

### Supporting Steps
These steps support the local behavior of the file.
- updateCounts(): Validate conditions and branch on failures and update DOM state

## Function Stories

### renderFixCards()
This routine materializes internal state into an output format that later stages can consume.

Inside the body, it mainly handles render or serialize the result, validate conditions and branch on failures, and update DOM state.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- render or serialize the result
- validate conditions and branch on failures
- update DOM state

Flow:
```mermaid
flowchart TD
    Start["renderFixCards()"]
    N0["Render fix cards"]
    N1["Render output"]
    N2["Validate branch"]
    D2{"Continue?"}
    R2["Return early path"]
    N3["Update DOM"]
    N4["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> D2
    D2 -->|yes| N3
    D2 -->|no| R2
    R2 --> End
    N3 --> N4
    N4 --> End
```

### renderChecklist()
This routine materializes internal state into an output format that later stages can consume.

Inside the body, it mainly handles render or serialize the result, validate conditions and branch on failures, and update DOM state.

It branches on runtime conditions instead of following one fixed path. The caller receives a computed result or status from this step.

What it does:
- render or serialize the result
- validate conditions and branch on failures
- update DOM state

Flow:
```mermaid
flowchart TD
    Start["renderChecklist()"]
    N0["Render checklist"]
    N1["Render output"]
    N2["Validate branch"]
    D2{"Continue?"}
    R2["Return early path"]
    N3["Update DOM"]
    N4["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> D2
    D2 -->|yes| N3
    D2 -->|no| R2
    R2 --> End
    N3 --> N4
    N4 --> End
```

### updateCounts()
This routine owns one focused piece of the file's behavior.

Inside the body, it mainly handles validate conditions and branch on failures and update DOM state.

It branches on runtime conditions instead of following one fixed path.

What it does:
- validate conditions and branch on failures
- update DOM state

Flow:
```mermaid
flowchart TD
    Start["updateCounts()"]
    N0["Update counts"]
    N1["Validate branch"]
    D1{"Continue?"}
    R1["Return early path"]
    N2["Update DOM"]
    N3["Hand back"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> D1
    D1 -->|yes| N2
    D1 -->|no| R1
    R1 --> End
    N2 --> N3
    N3 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.
