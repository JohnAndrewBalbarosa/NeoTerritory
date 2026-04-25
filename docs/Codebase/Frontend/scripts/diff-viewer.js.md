# diff-viewer.js

- Source: Frontend/scripts/diff-viewer.js
- Kind: JavaScript module

## Story
### What Happens Here

This script renders code and tree comparison artifacts returned from the backend. It may escape and format text for safe display, but the comparison data, AST output, and transformed source should come from the microservice artifact contract.

### Why It Matters In The Flow

Runs after a completed transform job when the user inspects source changes, parse-tree views, or report-backed diff output.

### What To Watch While Reading

Keep this script as a renderer. It should not compute pattern matches, rewrite source, or infer semantic changes. Those decisions must be produced by the microservice and delivered through the backend.

## Program Flow
This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Slice 1 - Continue Local Flow
```mermaid
flowchart TD
    N0["Open diff view"]
    N1["Request artifacts"]
    N2["Escape text"]
    N3["Choose tab"]
    N4["Render source"]
    N5["Render tree"]
    N6["Show report"]
    N7["Bind toggles"]
    N8["Handle empty"]
    N9["Return view"]
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
    N0["No artifact"]
    N1["Show fallback"]
    N2["Keep route"]
    N3["End view"]
    N0 --> N1
    N1 --> N2
    N2 --> N3
```

## Reading Map
Read this file as: Renders source and AST artifacts returned by the backend or microservice.

Where it sits in the run: Runs after result artifacts are available.

Names worth recognizing while reading: escapeHtml, renderCode, originalLines, transformedLines, el, and cls.

## Story Groups

### Small Preparation Steps
These steps clean up names, text, or small values before the larger work begins.
- escapeHtml(): Normalize or format text values

### Showing The Result
These steps turn internal state into text, HTML, JSON, or another output a reader can inspect.
- renderCode(): Render or serialize the result, validate conditions and branch on failures, and update DOM state

## Function Stories

### escapeHtml()
This helper reshapes small pieces of data so the surrounding code can stay readable.

Inside the body, it mainly handles normalize or format text values.

The caller receives a computed result or status from this step.

What it does:
- normalize or format text values

Flow:
```mermaid
flowchart TD
    Start["escapeHtml()"]
    N0["Escape html"]
    N1["Normalize text"]
    N2["Return local result"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> End
```

### renderCode()
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
    Start["renderCode()"]
    N0["Render code"]
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

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.
