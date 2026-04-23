# bootstrap_and_deploy_program_flow_01.ps1

- Source document: [bootstrap_and_deploy.ps1.md](../bootstrap_and_deploy.ps1.md)
- Purpose: decoupled implementation logic for a future code unit.

This diagram follows the action path in plain words. Decision diamonds show where the file can stop, branch, or repeat work instead of simply passing through a straight line.

### Block 1 - Program Flow Details
#### Part 1
```mermaid
flowchart TD
    N0["Start"]
    N1["Showing the result"]
    N2["Enter write-step()"]
    N3["Render output"]
    N4["Report status"]
    N5["Leave Write-Step()"]
    N6["Enter write-info()"]
    N7["Render output"]
    N8["Report status"]
    N9["Leave Write-Info()"]
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

#### Part 2
```mermaid
flowchart TD
    N0["Supporting steps"]
    N1["Enter test-commandexists()"]
    N2["Carry out test-command exists"]
    N3["Return result"]
    N4["Enter get-wingetpath()"]
    N5["Inspect files"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Branch condition"]
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

#### Part 3
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Return result"]
    N2["Enter get-dockerpath()"]
    N3["Inspect files"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Invoke tooling"]
    N7["Branch condition"]
    N8["Continue?"]
    N9["Stop path"]
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

#### Part 4
```mermaid
flowchart TD
    N0["Loop collection"]
    N1["More items?"]
    N2["Return result"]
    N3["Enter get-minikubepath()"]
    N4["Inspect files"]
    N5["Continue?"]
    N6["Stop path"]
    N7["Invoke tooling"]
    N8["Branch condition"]
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

#### Part 5
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Loop collection"]
    N2["More items?"]
    N3["Return result"]
    N4["Enter get-kubectlpath()"]
    N5["Inspect files"]
    N6["Continue?"]
    N7["Stop path"]
    N8["Invoke tooling"]
    N9["Branch condition"]
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

#### Part 6
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Loop collection"]
    N3["More items?"]
    N4["Return result"]
    N5["Enter invoke-externalcommand()"]
    N6["Report status"]
    N7["Branch condition"]
    N8["Continue?"]
    N9["Stop path"]
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

#### Part 7
```mermaid
flowchart TD
    N0["Leave Invoke-ExternalCommand()"]
    N1["Enter install-withwinget()"]
    N2["Report status"]
    N3["Branch condition"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Return result"]
    N7["Enter wait-fordocker()"]
    N8["Populate outputs"]
    N9["Report status"]
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

#### Part 8
```mermaid
flowchart TD
    N0["Invoke tooling"]
    N1["Branch condition"]
    N2["Continue?"]
    N3["Stop path"]
    N4["Loop collection"]
    N5["More items?"]
    N6["Return result"]
    N7["Enter test-minikubeprofilecorrupted()"]
    N8["Inspect files"]
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
