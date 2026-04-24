# pattern_middleman_contract.cpp

## Role
Defines the single public entrypoint for pattern tree assembly. This contract is shared by Behavioural and Creational callers.

## Intended Source Role
This file maps to the future public middleman interface. It should expose one request shape and one result shape for every pattern family.

## Contract Flow
```mermaid
flowchart TD
    Start["Call middleman"]
    N0["Receive request"]
    N1["Receive parse root"]
    N2["Receive family"]
    N3["Return tree"]
    End["Caller resumes"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```

## Responsibilities
- Provide one entrypoint.
- Accept Behavioural requests.
- Accept Creational requests.
- Hide shared assembly details.
- Return a finished tree.
- Avoid family-specific middlemen.

## Request Fields
- Parse root pointer.
- Pattern family.
- Pattern list.
- Scan options.
- Output labels.
- Error policy.

## Result Fields
- Root node.
- Matched children.
- Evidence records.
- Empty-result flag.
- Diagnostic messages.

## Validation Flow
```mermaid
flowchart TD
    Start["Request"]
    N0["Check root"]
    N1["Check family"]
    N2["Check hooks"]
    N3["Accept request"]
    End["Handle middleman"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> End
```
