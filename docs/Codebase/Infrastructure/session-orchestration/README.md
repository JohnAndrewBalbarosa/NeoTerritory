# session-orchestration

- Folder: docs/Codebase/Infrastructure/session-orchestration
- Descendant source docs: 5
- Generated on: 2026-04-23

## Logic Summary
Session bootstrap logic that prepares Docker, Minikube, runtime images, templates, and runtime folders.

## Child Folders By Logic
### Container Assets
- docker/ : Container image definitions used by the orchestration bootstrap.

### Kubernetes Assets
- k8s/ : Kubernetes deployment-side assets for user-scoped runtime sessions.

## Documents By Logic
### Bootstrap Orchestration
- bootstrap_and_deploy.ps1.md : Automates dependency install, Docker and Minikube startup, image build, template deployment, and runtime layout preparation.
- installer.config.json.md : Parameterizes the infrastructure bootstrap flow with image, profile, template, and runtime-root values.

## Reading Hint
- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.

