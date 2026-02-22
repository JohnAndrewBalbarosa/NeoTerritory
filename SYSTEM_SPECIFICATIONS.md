# NeoTerritory Research System Specifications

This document defines **research-oriented** baseline and best-performance specifications for the NeoTerritory C++ project, including its current local Kubernetes simulation using Minikube and the planned migration to a full Kubernetes server environment. Values are tuned for reproducible research and pipeline stability rather than consumer-grade minimums.

## Table 1. Research Development Environment Requirements

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Hardware** |  |  |
| CPU | 64-bit dual-core | 64-bit quad-core or higher |
| RAM | 8 GB | 16 GB or higher |
| Storage | 20 GB free (SSD preferred) | 50 GB+ free (SSD/NVMe) |
| **Software** |  |  |
| Build System | CMake 3.10+ [1] | Latest stable CMake |
| Compiler | GCC/G++ or Clang with C++17 support [1][2][3] | Latest stable GCC/Clang |
| Language Standard | C++17 (required) [1][4] | C++17+ (only if codebase is upgraded) |
| Version Control | Git (recommended for research traceability) | Latest Git |

Notes:
- The project is a **C++ research codebase**; requirements prioritize deterministic builds and repeatable experiments.

## Table 2. Containerization and Local Kubernetes (Minikube) Requirements

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Container Runtime** | Docker Engine or Docker Desktop [5][6] | Latest stable Docker |
| **Local Kubernetes** | Minikube for local cluster simulation [7] | Minikube with increased CPU/RAM allocation |
| CPU (Minikube) | 2 vCPUs minimum [7] | 4+ vCPUs for parallel experiments |
| RAM (Minikube) | 2 GB minimum [7] | 8 GB+ for multi-service workflows |
| Disk (Minikube) | 20 GB free [7] | 50 GB+ for datasets and images |

## Table 3. Target Kubernetes Server Baseline (Post-Minukube Migration)

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Kubernetes Node** | 2 vCPUs, 2 GB RAM per node (baseline kubeadm guidance) [8] | 4+ vCPUs, 8 GB+ RAM per node |
| Storage | 20 GB free per node [8] | 50 GB+ per node |
| OS | Linux nodes (recommended for cluster stability) | Latest stable LTS Linux |

Notes:
- Minikube is used to simulate the Kubernetes environment during research validation.
- After validation, the pipeline will be migrated to production Kubernetes servers.

## References

[1] NeoTerritory build config (`cmake_minimum_required(3.10)`, `CMAKE_CXX_STANDARD 17`):  
./CMakeLists.txt

[2] GCC C++ standards support:  
https://gcc.gnu.org/projects/cxx-status.html

[3] Clang C++ language status:  
https://clang.llvm.org/cxx_status.html

[4] CMake C++ standard variable:  
https://cmake.org/cmake/help/latest/variable/CMAKE_CXX_STANDARD.html

[5] Docker Desktop for Windows system requirements:  
https://docs.docker.com/desktop/setup/install/windows-install/

[6] Docker Desktop for Linux system requirements:  
https://docs.docker.com/desktop/setup/install/linux/

[7] Minikube requirements (CPU/RAM/Disk):  
https://minikube.sigs.k8s.io/docs/start/

[8] Kubernetes kubeadm minimum requirements:  
https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
