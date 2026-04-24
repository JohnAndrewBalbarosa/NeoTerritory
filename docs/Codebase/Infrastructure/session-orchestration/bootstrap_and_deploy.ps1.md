# bootstrap_and_deploy.ps1

- Source: Infrastructure/session-orchestration/bootstrap_and_deploy.ps1
- Kind: PowerShell script

## Story
### What Happens Here

This script implements the full environment bring-up path for NeoTerritory. It loads configuration, resolves dependency availability, starts Docker and Minikube when needed, builds the runtime image, applies Kubernetes templates, and finally prepares the folder layout consumed by the executable.

### Why It Matters In The Flow

Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared.

### What To Watch While Reading

Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation. The main surface area is easiest to track through symbols such as Write-Step, Write-Info, Test-CommandExists, and Get-WingetPath. It collaborates directly with docker, kubectl, minikube, and winget.

## Program Flow
Detailed program flow is decoupled into future implementation units:

- [program_flow_01](./bootstrap_and_deploy/bootstrap_and_deploy_program_flow_01.ps1.md)
- [program_flow_02](./bootstrap_and_deploy/bootstrap_and_deploy_program_flow_02.ps1.md)
## Reading Map
Read this file as: Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation.

Where it sits in the run: Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared.

Names worth recognizing while reading: Write-Step, Write-Info, Test-CommandExists, Get-WingetPath, Get-DockerPath, and Get-MinikubePath.

It leans on nearby contracts or tools such as docker, kubectl, minikube, winget, and Codebase/Infrastructure/runtime-layout/setup_runtime_layout.ps1.

## Story Groups

### Finding What Matters
These steps pick out the facts, traces, and relationships that later stages need.
- Resolve-AbsolutePath(): Connect discovered data back into the shared model and branch on local conditions

### Changing Or Cleaning The Picture
These steps adjust existing state or remove stale pieces after better information is available.
- Remove-MinikubeProfileArtifacts(): Remove obsolete transformed artifacts, inspect the current filesystem state, and create or update filesystem artifacts

### Showing The Result
These steps turn internal state into text, HTML, JSON, or another output a reader can inspect.
- Write-Step(): Render or serialize the result and report status or failures to the caller
- Write-Info(): Render or serialize the result and report status or failures to the caller

### Main Path
These steps drive the main execution path by calling the supporting work in order.
- Start-MinikubeWithRecovery(): Drive the main execution path, report status or failures to the caller, and invoke external tooling

### Supporting Steps
These steps support the local behavior of the file.
- Test-CommandExists(): Owns a focused local responsibility.
- Get-WingetPath(): Inspect the current filesystem state and branch on local conditions
- Get-DockerPath(): Inspect the current filesystem state, invoke external tooling, and branch on local conditions
- Get-MinikubePath(): Inspect the current filesystem state, invoke external tooling, and branch on local conditions
- Get-KubectlPath(): Inspect the current filesystem state, invoke external tooling, and branch on local conditions
- Invoke-ExternalCommand(): Report status or failures to the caller and branch on local conditions
- Install-WithWinget(): Report status or failures to the caller and branch on local conditions
- Wait-ForDocker(): fill local output fields, report status or failures to the caller, and invoke external tooling
- Test-MinikubeProfileCorrupted(): Inspect the current filesystem state and invoke external tooling
- Invoke-MinikubeDeleteBestEffort(): Report status or failures to the caller, invoke external tooling, and branch on local conditions
- Apply-K8sTemplate(): Inspect the current filesystem state, create or update filesystem artifacts, and invoke external tooling

## Function Stories
Function-level logic is decoupled into future implementation units:

- [write_step](./bootstrap_and_deploy/functions/write_step.ps1.md)
- [write_info](./bootstrap_and_deploy/functions/write_info.ps1.md)
- [test_commandexists](./bootstrap_and_deploy/functions/test_commandexists.ps1.md)
- [get_wingetpath](./bootstrap_and_deploy/functions/get_wingetpath.ps1.md)
- [get_dockerpath](./bootstrap_and_deploy/functions/get_dockerpath.ps1.md)
- [get_minikubepath](./bootstrap_and_deploy/functions/get_minikubepath.ps1.md)
- [get_kubectlpath](./bootstrap_and_deploy/functions/get_kubectlpath.ps1.md)
- [invoke_externalcommand](./bootstrap_and_deploy/functions/invoke_externalcommand.ps1.md)
- [install_withwinget](./bootstrap_and_deploy/functions/install_withwinget.ps1.md)
- [wait_fordocker](./bootstrap_and_deploy/functions/wait_fordocker.ps1.md)
- [test_minikubeprofilecorrupted](./bootstrap_and_deploy/functions/test_minikubeprofilecorrupted.ps1.md)
- [invoke_minikubedeletebesteffort](./bootstrap_and_deploy/functions/invoke_minikubedeletebesteffort.ps1.md)
- [remove_minikubeprofileartifacts](./bootstrap_and_deploy/functions/remove_minikubeprofileartifacts.ps1.md)
- [start_minikubewithrecovery](./bootstrap_and_deploy/functions/start_minikubewithrecovery.ps1.md)
- [resolve_absolutepath](./bootstrap_and_deploy/functions/resolve_absolutepath.ps1.md)
- [apply_k8stemplate](./bootstrap_and_deploy/functions/apply_k8stemplate.ps1.md)
## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-23 after reading the existing docs corpus and the current source tree.