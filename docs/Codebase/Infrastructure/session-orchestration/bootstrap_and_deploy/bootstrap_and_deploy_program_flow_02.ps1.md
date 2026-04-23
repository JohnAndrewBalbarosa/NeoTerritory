# bootstrap_and_deploy_program_flow_02.ps1

- Source document: [bootstrap_and_deploy.ps1.md](../bootstrap_and_deploy.ps1.md)
- Purpose: decoupled implementation logic for a future code unit.

#### Part 9
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Invoke tooling"]
    N2["Return result"]
    N3["Enter invoke-minikubedeletebesteffort()"]
    N4["Report status"]
    N5["Invoke tooling"]
    N6["Branch condition"]
    N7["Continue?"]
    N8["Stop path"]
    N9["Leave Invoke-MinikubeDeleteBestEffort()"]
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

#### Part 10
```mermaid
flowchart TD
    N0["Changing or cleaning the picture"]
    N1["Enter remove-minikubeprofileartifacts()"]
    N2["Remove obsolete"]
    N3["Inspect files"]
    N4["Continue?"]
    N5["Stop path"]
    N6["Update files"]
    N7["More items?"]
    N8["Report status"]
    N9["Invoke tooling"]
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

#### Part 11
```mermaid
flowchart TD
    N0["Branch condition"]
    N1["Continue?"]
    N2["Stop path"]
    N3["Leave Remove-MinikubeProfileArtifacts()"]
    N4["Main path"]
    N5["Enter start-minikubewithrecovery()"]
    N6["Drive path"]
    N7["Report status"]
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

#### Part 12
```mermaid
flowchart TD
    N0["Continue?"]
    N1["Stop path"]
    N2["Return result"]
    N3["Finding what matters"]
    N4["Enter resolve-absolutepath()"]
    N5["Connect data"]
    N6["Branch condition"]
    N7["Continue?"]
    N8["Stop path"]
    N9["Return result"]
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

#### Part 13
```mermaid
flowchart TD
    N0["Supporting steps"]
    N1["Enter apply-k8stemplate()"]
    N2["Inspect files"]
    N3["Continue?"]
    N4["Stop path"]
    N5["Update files"]
    N6["More items?"]
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

#### Part 14
```mermaid
flowchart TD
    N0["Stop path"]
    N1["Leave Apply-K8sTemplate()"]
    N2["End"]
    N0 --> N1
    N1 --> N2
```
