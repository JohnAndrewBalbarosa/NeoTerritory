# Dockerfile

- Source: Infrastructure/session-orchestration/docker/Dockerfile
- Kind: Container build definition
- Lines: 19
- Role: Builds the container image used for per-user NeoTerritory sessions.
- Chronology: Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared.

## Notable Symbols
- This artifact is primarily declarative or inline and does not expose many named symbols.

## Direct Dependencies
- ubuntu:24.04
- . /app

## Implementation Story
This file implements the container build recipe for NeoTerritory session execution. It defines the image composition that later gets built and deployed by the bootstrap scripts. Builds the container image used for per-user NeoTerritory sessions. Runs before the C++ executable when the environment, runtime folders, container image, or Kubernetes assets need to be prepared. In practice it collaborates directly with ubuntu:24.04 and . /app.

## Activity Diagram
```mermaid
flowchart TD
    Start([Start])
    N0[FROM ubuntu:24.04]
    N1[RUN apt-get update \]
    N2[COPY . /app]
    N3[RUN mkdir -p /build \]
    N4[CMD ('/build/NeoTerritory')]
    End([End])
    Start --> N0
    N0 --> N1
    N1 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> End
```

## Documentation Note
- This markdown file is part of the generated docs/Codebase mirror.
- It was generated from the repository state on 2026-04-22 after reading the existing docs corpus and the current source tree.

