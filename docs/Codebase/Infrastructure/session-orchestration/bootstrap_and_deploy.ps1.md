# bootstrap_and_deploy.ps1

- Source: Infrastructure/session-orchestration/bootstrap_and_deploy.ps1
- Kind: PowerShell script
- Lines: 612
- Role: Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation.
- Chronology: Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared.

## Notable Symbols
- Write-Step
- Write-Info
- Test-CommandExists
- Get-WingetPath
- Get-DockerPath
- Get-MinikubePath
- Get-KubectlPath
- Invoke-ExternalCommand
- Install-WithWinget
- Wait-ForDocker
- Test-MinikubeProfileCorrupted
- Invoke-MinikubeDeleteBestEffort

## Direct Dependencies
- docker
- kubectl
- minikube
- winget
- Infrastructure/runtime-layout/setup_runtime_layout.ps1

## Implementation Story
This script implements the full environment bring-up path for NeoTerritory. It loads configuration, resolves dependency availability, starts Docker and Minikube when needed, builds the runtime image, applies Kubernetes templates, and finally prepares the folder layout consumed by the executable. Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation. Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared. The implementation surface is easiest to recognize through symbols such as Write-Step, Write-Info, Test-CommandExists, and Get-WingetPath. In practice it collaborates directly with docker, kubectl, minikube, and winget.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[Run write-step]
    N1[Run write-info]
    N2[Run test-command exists]
    N3[Run get-winget path]
    N4[Run get-docker path]
    N5[Run get-minikube path]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> N5
    N5 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

