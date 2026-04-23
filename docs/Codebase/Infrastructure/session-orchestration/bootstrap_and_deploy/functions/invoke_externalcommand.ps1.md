# invoke_externalcommand.ps1

- Source document: [bootstrap_and_deploy.ps1.md](../../bootstrap_and_deploy.ps1.md)
- Purpose: decoupled implementation logic for a future code unit.

### Invoke-ExternalCommand()
This routine owns one focused piece of the file's behavior. It appears near line 136.

Inside the body, it mainly handles report status or failures to the caller and branch on runtime conditions.

It branches on runtime conditions instead of following one fixed path.

What it does:
- report status or failures to the caller
- branch on runtime conditions

Flow:
```mermaid
flowchart TD
    Start["Invoke-ExternalCommand()"]
    N0["Enter invoke-externalcommand()"]
    N1["Report status"]
    N2["Branch condition"]
    D2{"Continue?"}
    R2["Stop path"]
    N3["Hand back"]
    End["Return"]
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> D2
    D2 -->|yes| N3
    D2 -->|no| R2
    R2 --> End
    N3 --> End
```
