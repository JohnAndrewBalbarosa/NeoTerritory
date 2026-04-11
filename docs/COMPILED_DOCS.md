# Compiled Markdown Documentation

This file compiles all markdown documents in the repository while preserving tree-style paths.

Generated: 2026-04-11 17:28:35

## Markdown Tree Structure

```text
NeoTerritory/
  .github/copilot-instructions.md
  Backend/.github/copilot-instructions.md
  Backend/README.md
  CONTRIBUTING.md
  Infrastructure/session-orchestration/README.md
  Microservice/Docs/AST_Pipeline_Step_Map.md
  Microservice/Modules/Header/Behavioural/DETECTION_FORMAT.md
  Microservice/Modules/Header/Creational/DETECTION_FORMAT.md
  Microservice/Modules/Source/Behavioural/DETECTION_FORMAT.md
  Microservice/Modules/Source/Creational/DETECTION_FORMAT.md
  Microservice/Test/Input/README.md
  SYSTEM_SPECIFICATIONS.md
```

## Compiled Contents

---

### .github/copilot-instructions.md

# NeoTerritory AI Coding Agent Instructions

## Project Overview
NeoTerritory is a C++ research project focused on syntactic analysis and AST (Abstract Syntax Tree) manipulation. The core module, **SyntacticBrokenAST**, provides lexical analysis, token parsing, and AST construction/transformation capabilities.

## Architecture

### Core Module: SyntacticBrokenAST
Located in `Project/Modules/SyntacticBrokenAST/`, this module implements:

- **Lexer** (`lexer.hpp/cpp`): Tokenizes source code into `Token` objects with metadata (line, column, type)
- **Token System** (`token.hpp/cpp`): Defines `TokenType` enum (Preprocessor, Identifier, Keyword, Literals, Operators, etc.)
- **AST Nodes** (`ast.hpp`): Base `ASTNode` struct with parent-child relationship management via `addChild()`
- **Virtual Nodes** (`virtual_node.hpp`): Wrapper nodes that track metadata and dirty state for transformation tracking
- **AST Utilities** (`ast_utils.hpp/cpp`): Tree traversal, height calculation, and debug printing
- **Transform Module** (`transform.hpp/cpp`): Node wrapping logic for entry/exit point instrumentation

### Application Layer
`Project/Layer/Back system/` contains:
- `syntacticBrokenAST.cpp`: Main application that reads source, builds a function graph focusing on `main()`, and applies transformations
- Test files: `syntacticBrokenAST_read_source_test.cpp` for I/O validation

## Key Patterns

### AST Construction
The `build_function_graph()` function scans tokens for the `main` function, wrapping it with `VirtualNode` entry/exit nodes:
```cpp
VirtualNode* entry_wrapper = wrap_node(function, true);
VirtualNode* exit_wrapper = wrap_node(function, false);
entry_wrapper->addChild(function);
function->addChild(exit_wrapper);
```
This pattern is central to control-flow instrumentation.

### Input Handling
Source code is read via:
1. Command-line argument: `program <file_path>`
2. Stdin fallback: reads from standard input if no file provided

See `read_source()` in `syntacticBrokenAST.cpp` for implementation.

### Token Metadata
Every `Token` tracks position (`line`, `column`) and type. The `Lexer` maintains state for accurate source mappingâ€”critical for error reporting and AST decoration.

## Build & Execution

### Build Command
```bash
g++.exe -fdiagnostics-color=always -g -I./Project/Modules/SyntacticBrokenAST \
  <source_file> \
  ./Project/Modules/SyntacticBrokenAST/lexer.cpp \
  ./Project/Modules/SyntacticBrokenAST/token.cpp \
  ./Project/Modules/SyntacticBrokenAST/ast_utils.cpp \
  ./Project/Modules/SyntacticBrokenAST/transform.cpp \
  -o <output.exe>
```

The task `"C/C++: g++.exe build active file"` in VS Code automates thisâ€”includes `-I` for module headers and links all `.cpp` implementations.

### Running Tests
- `syntacticBrokenAST_read_source_test.cpp`: Validates source file I/O
- Compile with the same command, then run: `./output.exe <test_file>`

## Development Conventions

### Memory Management
AST nodes are dynamically allocated (`new`). There is no explicit cleanup visible in current codeâ€”be aware of potential memory leaks when extending the tree manipulation logic. Consider implementing a cleanup pass or RAII patterns if extending.

### Error Handling
- `Lexer::makeError()` creates error tokens with message metadata
- `read_source()` returns empty string on file read failure; callers must validate
- No exceptions are used; rely on return codes and error tokens

### Namespace & Naming
- Anonymous namespace used for `read_source()` in `syntacticBrokenAST.cpp`
- Derived node types (e.g., `FunctionNode`) add semantic data (e.g., `name` field) to base `ASTNode`

## Contribution Guidelines

Follow [CONTRIBUTING.md](../CONTRIBUTING.md):
- Branch naming: `feature/<name>` or `fix/<name>`
- PR review required before merge to `main`
- Update docs when changing core module interfaces
- Test changes against the provided test files

## References
- **Lexer Output**: `Lexer::scan()` returns `std::vector<Token>` with full source mapping
- **AST Traversal**: Use `traverse()` utility for depth-first visitor pattern
- **Debug**: `print_tree()` outputs AST structure for verification

---

### Backend/.github/copilot-instructions.md

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Ensure Documentation is Complete

All steps completed for Node.js + Express backend with SQLite, JWT, file upload, and modular structure.

---

### Backend/README.md

# Thesis Code Transformation Backend

A secure Node.js + Express backend for code transformation workflows, with authentication, file upload, and SQLite storage.

## Setup & Run

1. Install dependencies:
   ```sh
   npm install
   ```
2. Configure environment in `.env` (see sample in repo).
3. Start in dev mode:
   ```sh
   npm run dev
   ```
   Or production:
   ```sh
   npm start
   ```

## API Endpoints

### Health
- `GET /health` â†’ `{ "status": "Backend running" }`

### Auth
- `POST /auth/register` â€” `{ username, email, password }`
- `POST /auth/login` â€” `{ email, password }` â†’ `{ token }`

### Transformation
- `POST /api/transform` (JWT required)
  - Upload: single file (`.cpp`, `.cc`, `.cxx`, `.rs`), max 2MB
  - Returns job info and output placeholder

## Directory Structure
- `src/` â€” main code
- `routes/`, `controllers/`, `middleware/`, `services/`, `db/`, `utils/`
- `uploads/` â€” uploaded files
- `outputs/` â€” transformation outputs

## Quick Test Commands

Register:
```
curl -X POST http://localhost:3001/auth/register -H "Content-Type: application/json" -d '{"username":"testuser","email":"test@example.com","password":"testpass"}'
```

Login:
```
curl -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"testpass"}'
```

Health:
```
curl http://localhost:3001/health
```

Protected upload (replace TOKEN and FILE):
```
curl -X POST http://localhost:3001/api/transform -H "Authorization: Bearer TOKEN" -F "file=@/path/to/source.cpp"
```

---

### CONTRIBUTING.md

# Contributing to NeoTerritory

Thank you for your interest in contributing to NeoTerritory! This document outlines the guidelines, roles, and permissions for team members.

## Team Roles and Responsibilities

### Project Owner
**John Andrew Balbarosa**
- Overall project management and direction
- Final approval on major decisions
- Repository administration
- Access to all repository settings

### Core Contributors
**All Team Members:**
- Collin Andrei Yapchullay
- Josephine Santander
- Myril De Leon
- John Andrew Balbarosa

**Responsibilities:**
- Contribute to research and development
- Review pull requests
- Participate in team discussions
- Maintain code quality and documentation

## Repository Permissions

### Branch Protection
- The `main` branch is protected
- All changes must go through pull requests
- At least one approval required before merging
- All tests must pass before merging

### Access Levels
- **Admin:** Repository owner
- **Write:** All core contributors
- **Read:** Public access for research purposes

## Contribution Workflow

### 1. Creating Issues
- Use clear, descriptive titles
- Provide detailed descriptions of the problem or feature
- Add relevant labels (bug, enhancement, documentation, etc.)
- Assign to appropriate team member(s)

### 2. Working on Issues
- Assign yourself to an issue before starting work
- Create a new branch from `main` for your work
- Use descriptive branch names (e.g., `feature/add-timeline`, `fix/readme-typo`)

### 3. Making Changes
- Write clear, concise commit messages
- Follow the existing code style and conventions
- Update documentation as needed
- Test your changes thoroughly

### 4. Submitting Pull Requests
- Create a pull request when your work is ready for review
- Link related issues in the PR description
- Provide a clear description of changes
- Request review from at least one team member
- Address review comments promptly

### 5. Code Review
- Review assigned pull requests in a timely manner
- Provide constructive feedback
- Approve when changes are satisfactory
- Suggest improvements when needed

### 6. Merging
- Ensure all checks pass
- Obtain required approvals
- Merge using the appropriate strategy (usually squash and merge)
- Delete the branch after merging

## Communication Guidelines

### Team Meetings
- Regular check-ins as scheduled in the timeline
- Come prepared with updates and questions
- Document decisions and action items

### Discussion Etiquette
- Be respectful and professional
- Stay on topic
- Provide constructive feedback
- Ask questions when unclear

### Response Times
- Aim to respond to mentions within 24-48 hours
- Mark urgent items clearly
- Notify team if you'll be unavailable

## Documentation Standards

### Code Documentation
- Comment complex logic
- Use clear variable and function names
- Update README when adding new features

### Project Documentation
- Keep all documentation files up to date
- Use markdown formatting consistently
- Include examples where helpful

## Quality Standards

### Before Submitting
- [ ] Code follows project conventions
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] No unnecessary files included

### Code Review Checklist
- [ ] Changes solve the stated problem
- [ ] Code is readable and maintainable
- [ ] No security or performance issues
- [ ] Documentation is adequate
- [ ] Tests are appropriate

## Getting Help

### Questions and Support
- Open an issue for project-related questions
- Tag relevant team members for specific expertise
- Use discussions for brainstorming and general questions

### Resources
- Check existing documentation first
- Review closed issues for similar problems
- Consult the project timeline for deadlines

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [LGPL-2.1 License](LICENSE).

## Recognition

All contributors will be acknowledged in the project. Thank you for your contributions to NeoTerritory!

---

*Last updated: October 2025*

---

### Infrastructure/session-orchestration/README.md

# Session Orchestration Assets

This folder is intentionally decoupled from the C++ source tree and contains only container/orchestration assets for per-user runtime sessions.

## Structure

- `docker/Dockerfile`
- `k8s/templates/user-session-pod.yaml`
- `k8s/templates/user-routing.yaml`
- `installer.config.json`
- `bootstrap_and_deploy.ps1`

## Windows Automation (PowerShell)

Use the bootstrap script to install dependencies, start Kubernetes, build the image, deploy templates, and prepare runtime I/O layout.

From repo root:

```powershell
.\setup.ps1
```

Direct call with config override:

```powershell
.\Infrastructure\session-orchestration\bootstrap_and_deploy.ps1 -ConfigPath .\Infrastructure\session-orchestration\installer.config.json
```

Common overrides:

```powershell
.\setup.ps1 -UserId student42 -Image neoterritory:v1
```

Skip selected phases when tools are already installed:

```powershell
.\setup.ps1 -SkipDependencyInstall -SkipDockerStart
```

Legacy WSL-only tool install (previous behavior):

```powershell
.\setup.ps1 -LegacyWslToolsInstall
```

## Template Variables

- `{{user_id}}`: unique user/session id managed by your Manager API.
- `{{image}}`: container image reference built from `docker/Dockerfile`.

## Notes

- `user-session-pod.yaml` is a single-Pod template with:
  - `activeDeadlineSeconds: 3600`
  - `resources.requests`: `cpu: "1"`, `memory: "2Gi"`
  - `resources.limits`: `cpu: "2"`, `memory: "4Gi"`
- `user-routing.yaml` provides:
  - one dedicated ClusterIP Service per `user_id`
  - one dedicated Ingress path: `/session/{{user_id}}`
- No Deployment or ReplicaSet resources are included.

---

### Microservice/Docs/AST_Pipeline_Step_Map.md

# AST Pipeline Step Map

## Scope

This map documents the implemented pipeline behavior and ownership boundaries.

## Ownership Boundary (Implemented)

- `SyntacticBrokenAST` owns generic parsing, AST construction, hash links, symbol indexing, and pipeline/report orchestration.
- `Creational` owns creational detection and creational code transforms/evidence rendering.
- `Behavioural` owns behavioural detection and behavioural structural hook keyword providers.

`SyntacticBrokenAST` now delegates pattern-specific logic instead of implementing pattern transforms directly.

## A1. CLI + Context Entry

- CLI captures source/target pattern and input folder files.
- Parse context is passed into lexical parsing and downstream pipeline stages.

## A2. Root + File Separation

- Parse root: `TranslationUnit("Root")`
- Immediate children: per-file `FileUnit`

## A3. Dual Tree Build

- `main_tree`: full parse graph
- `shadow_tree`: relevance-filtered virtual graph

## A4. Class Registration + Line Hash Traces

During lexical parse:

- class name hash and file-aware class context hash are registered
- line traces capture `matched_class_contextual_hash`, `outgoing_hash`, `hash_chain`, and collision markers

## A5. Scope Propagation Hashing

- Child contextual hashes derive from parent hash + node identity + sibling index
- Usage hashes are propagated within lexical scope and copied into parse nodes

## A6. File Bucketization

Each file node is bucketized for traversal:

- `ClassDeclarations`
- `GlobalFunctionDeclarations`

Applied to both actual and virtual trees.

## A7. Symbol Tables + Overload-safe Function Keys

Function identity key includes:

- file path
- owner scope
- function name
- parameter hint

This prevents same-name overload collisions across files/scopes.

## A8. Hash Link Stage (Paired File View)

Hash-link stage emits paired traversal context:

- `Root -> FileUnit -> ActualParseTree`
- `Root -> FileUnit -> VirtualParseTree`

Bidirectional link indexing includes:

- class anchors (class hash + contextual hash)
- usage anchors (outgoing/hash_chain + propagated usage hashes)

Collision disambiguation contract:

1. class-name hash candidates
2. parent ancestry expansion
3. file basename
4. full file path
5. node index path tie-break

## A9. Report Serialization

Report includes:

- class registry links for actual/virtual trees
- line hash trace links for class anchors and usage anchors
- ancestry metadata:
  - `readable_ancestry`
  - `hash_ancestry`
- link status fields:
  - `unique | multi_match | unresolved`
- transform decision projection per class:
  - `transform_applied`
  - `transform_reason[]`

## Delegation Flow (Current)

- `generate_target_code_from_source(...)` in Syntactic delegates transform execution to Creational transform pipeline.
- `generate_base_code_from_source(...)` and target rendering delegate evidence rendering to Creational.
  - `singleton -> builder` uses monolithic evidence sections/skeletons.
  - other routes (including `* -> singleton`) use passthrough generated code view with single-main retention.
- Lexical structural hooks in Syntactic resolve keywords via Creational and Behavioural providers.

---

### Microservice/Modules/Header/Behavioural/DETECTION_FORMAT.md

# Behavioural Detection Format (Header Index)

Implementation and rule details are documented in:

- `Project/Modules/Source/Behavioural/DETECTION_FORMAT.md`

Public APIs related to detection:

- `build_behavioural_broken_tree(...)`
- `build_behavioural_broken_tree(..., const IBehaviouralTreeCreator&, const std::vector<const IBehaviouralDetector*>&)`
- `build_behavioural_function_scaffold(...)`
- `build_behavioural_structure_checker(...)`
- `IBehaviouralDetector`
- `IBehaviouralTreeCreator`

---

### Microservice/Modules/Header/Creational/DETECTION_FORMAT.md

# Creational Detection Format (Header Index)

Implementation and rule details are documented in:

- `Project/Modules/Source/Creational/DETECTION_FORMAT.md`

Public APIs related to detection:

- `build_creational_broken_tree(...)`
- `build_creational_broken_tree(..., const ICreationalTreeCreator&, const std::vector<const ICreationalDetector*>&)`
- `build_factory_pattern_tree(...)`
- `build_singleton_pattern_tree(...)`
- `build_builder_pattern_tree(...)`
- `check_builder_pattern_structure(...)`
- `ICreationalDetector`
- `ICreationalTreeCreator`

---

### Microservice/Modules/Source/Behavioural/DETECTION_FORMAT.md

# Behavioural Detection Format

## Current Ownership

- Behavioural pattern detection is owned by the **Behavioural** module.
- Behavioural structural keyword hooks are owned by:
  - `Modules/Header/Behavioural/Logic/behavioural_structural_hooks.hpp`
  - `Modules/Source/Behavioural/Logic/behavioural_structural_hooks.cpp`
- `SyntacticBrokenAST` no longer implements strategy/observer keyword rules; it only delegates to Behavioural hook providers.

## Detector Composition

Default composition remains under `behavioural_broken_tree.cpp`:

1. Function scaffold detector
2. Behavioural structure checker detector

Output roots and node kinds remain:

- `BehaviouralPatternsRoot`
- `BehaviouralEntryRoot`
- `BehaviouralStructureCheckRoot`
- `FunctionNode`
- `ClassNode`
- `StrategyInterfaceCandidate`
- `StrategyContextCandidate`
- `ObserverSubjectCandidate`
- `ObserverListenerCandidate`

## Structural Hook Contract

`resolve_behavioural_structural_keywords(...)` provides source-pattern keyword sets for:

- `strategy` -> `StrategyStructuralStrategy`
- `observer` -> `ObserverStructuralStrategy`

The lexical parser applies these keywords generically and records matched classes into `CrucialClassInfo`.

## Non-Ownership Clarification

Behavioural module does not own creational transforms (singleton/builder/factory rewrites). Those are owned by `Creational/Transform`.

---

### Microservice/Modules/Source/Creational/DETECTION_FORMAT.md

# Creational Detection + Transform Format

## Current Ownership

Creational pattern implementation is owned by the **Creational** module.

### Detection ownership

- `creational_broken_tree.cpp`
- `Factory/factory_pattern_logic.cpp`
- `Singleton/singleton_pattern_logic.cpp`
- `Builder/builder_pattern_logic.cpp`

### Transform ownership

- Public transform facade:
  - `Header/Creational/Transform/creational_transform_pipeline.hpp`
  - `Source/Creational/Transform/creational_transform_pipeline.cpp`
- Internal transform implementation:
  - `creational_code_generator_internal.cpp`
  - `creational_transform_rules.cpp`
  - `creational_transform_evidence.cpp`
  - `creational_transform_factory_reverse.cpp`

`SyntacticBrokenAST` no longer owns singleton/builder/factory transformation logic.

## Detection Roots

The aggregate creational root is:

- `CreationalPatternsRoot`

Detector sub-roots:

- `FactoryPatternRoot`
- `SingletonPatternRoot`
- `BuilderPatternRoot`

## Transform Rule Contract

Rule dispatch is creational-owned and currently supports:

1. `factory -> base` (reverse-factory to direct instantiation)
2. `singleton -> builder`
3. `* -> singleton`

`factory -> base` scope:

- scans single-line declaration-initializer callsites of:
  - `... = FactoryClass::create(literal);`
  - `... = factoryObj.create(literal);`
  - `... = factoryPtr->create(literal);`
- scans single-line assignment callsites of:
  - `var = FactoryClass::create(literal);`
  - `var = factoryObj.create(literal);`
  - `var = factoryPtr->create(literal);`
  - assignment rewrite requires a prior typed declaration for `var`; otherwise rewrite is skipped (`factory_result_declaration_unresolved`)
- supports exact-token literal argument mapping (`"str"`, `'c'`, integer, bare identifier like `zero`)
- maps `if/else-if` equality branches and `switch/case` branches in `create(...)`
- builds a hash ledger for each vital branch return:
  - vital line format: `return <creation-expression>;`
  - normalization: collapse ASCII whitespace and preserve expression order
  - hash id: deterministic `fnv1a64:<16-hex>` over normalized vital line
  - mapping shape: `literal -> {hash_id, creation_expression, normalized_vital_part}`
- resolves instance-call receiver type from typed factory declarations in the same monolithic source view
- rewrites declaration types only for:
  - `std::unique_ptr<Base>` -> `std::unique_ptr<Concrete>`
  - `std::shared_ptr<Base>` -> `std::shared_ptr<Concrete>`
  - `Base*` -> `Concrete*`
  - keeps `auto` unchanged
- preserves allocator style (`make_unique`, `make_shared`, `new`)
- records transform traces (`transform_trace`) with selected callsite/argument/hash-id/creation mapping
- skips ambiguous/unsupported callsites and records transform reasons
- removes now-unused factory instance declarations after successful inlining
- safely deletes the Factory class only when no remaining references exist outside class definition
- phase-1 report includes advisory `factory_invocation_traces[]` with invocation form, receiver token, resolved class (if known), raw argument token, and `fnv1a64` argument hash

Result contract from creational transform pipeline:

- transformed source text
- `TransformDecision[]` including:
  - `transform_applied`
  - `transform_reason[]`
  - `transform_trace[]` (hash-ledger and rewrite trace lines)

## Evidence View Contract

Creational evidence rendering owns base/target monolithic evidence output:

- `render_creational_evidence_view(source, target, target_view, source_pattern, target_pattern)`

Rendering mode is pattern-aware:

1. `singleton -> builder`:
   - emits evidence sections used by reporting:
     - source view: `EVIDENCE_PRESENT`
     - target view: `EVIDENCE_REMOVED`, `EVIDENCE_ADDED`
     - plus `TYPE_SKELETON` and `CALLSITE_SKELETON`
2. `factory -> base`:
   - base output remains source/base view (`generated_base_code.cpp`)
   - transformed output is emitted in target output (`generated_target_code_base.cpp`)
3. Other routes (including `* -> singleton`):
   - emits passthrough source/target code view
   - retains one preferred `main()` (matching `<source>_to_<target>` file hint when available) to keep generated `.cpp` outputs compilable.

## Factory Detection Backlog

Potential future extensions (not implemented in the current scope):

- factory alias methods (`make`, `build`, provider-specific names)
- enum/constexpr/identifier argument resolution beyond direct literals
- multi-line callsite parsing and chained/wrapped invocation forms
- constructor-wrapper or helper-function indirection resolution before inlining

## Structural Hook Ownership

Creational structural keyword hooks are provided by:

- `Header/Creational/Logic/creational_structural_hooks.hpp`
- `Source/Creational/Logic/creational_structural_hooks.cpp`

Supported pattern hooks:

- `factory` -> `FactoryStructuralStrategy`
- `singleton` -> `SingletonStructuralStrategy`
- `builder` -> `BuilderStructuralStrategy`

---

### Microservice/Test/Input/README.md

# Sample Analysis Inputs

Use these files as CLI input for the static analysis pipeline:

- `factory_to_singleton_source.cpp`: contains factory + singleton pattern candidates.
- `factory_to_base_instance_source.cpp`: factory instance-call regression for `factory -> base` (assignment-form callsite).
- `factory_to_base_kind_numeric_source.cpp`: numeric literal exact-match regression for `factory -> base` (`kind == 1`, `create(1)`).
- `factory_to_base_identifier_literal_source.cpp`: identifier literal exact-match regression for `factory -> base` (`kind == zero`, `create(zero)`).
- `factory_to_base_unresolved_instance_source.cpp`: unresolved factory instance typing regression for `factory -> base`.
- `factory_to_base_non_literal_source.cpp`: non-literal argument regression for `factory -> base`.
- `singleton_to_factory_source.cpp`: contains singleton pattern candidates (`source_pattern=singleton`, `target_pattern=factory`).
- `singleton_to_builder_source.cpp`: contains singleton pattern candidates (`source_pattern=singleton`, `target_pattern=builder`).
- `builder_to_singleton_source.cpp`: contains builder pattern candidates (`source_pattern=builder`, `target_pattern=singleton`).
- `domain_models_source.cpp`: contains non-pattern domain classes (`Driver`, `FleetVehicle`, `Trip`) for context.

## Expected outputs after running

- `parse_tree.html`
- `creational_parse_tree.html`
- `behavioural_broken_ast.html`
- `generated_base_code.cpp`
- `generated_base_code.html`
- `generated_target_code_<target_pattern>.cpp`
- `generated_target_code_<target_pattern>.html`
- `analysis_report.json`

The non-pattern domain classes are included only as context and should not be the main target of creational pattern detection.

---

### SYSTEM_SPECIFICATIONS.md

# NeoTerritory Research System Specifications

This document defines **research-oriented** baseline and best-performance specifications for the NeoTerritory C++ project, including its current local Kubernetes simulation using Minikube and the planned migration to a full Kubernetes server environment. Values are tuned for reproducible research and pipeline stability rather than consumer-grade minimums.

## Table 1. Research Development Hardware Requirements

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Hardware** |  |  |
| CPU | 64-bit dual-core | 64-bit quad-core or higher |
| RAM | 8 GB | 16 GB or higher |
| Storage | 5 GB free (SSD preferred) [9] | 20 GB+ free (SSD/NVMe) [9][10] |

## Table 2. Research Development Software Requirements

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Software** |  |  |
| Build System | CMake 3.10+ [1] | Latest stable CMake |
| Compiler | GCC/G++ or Clang with C++17 support [1][2][3] | Latest stable GCC/Clang |
| Language Standard | C++17 (required) [1][4] | C++17+ (only if codebase is upgraded) |
| Version Control | Git (recommended for research traceability) | Latest Git |

Notes:
- The project is a **C++ research codebase**; requirements prioritize deterministic builds and repeatable experiments.
- 5 GB minimum aligns with Git hosting guidance that repositories should ideally be under 1 GB and strongly recommended under 5 GB; 20 GB+ provides room for build artifacts, containers, and datasets if the research workflow expands. [9][10]

## Table 3. Containerization and Local Kubernetes (Minikube) Requirements

| Specifications | Minimum Requirements | Best Performance |
|---|---|---|
| **Container Runtime** | Docker Engine or Docker Desktop [5][6] | Latest stable Docker |
| **Local Kubernetes** | Minikube for local cluster simulation [7] | Minikube with increased CPU/RAM allocation |
| CPU (Minikube) | 2 vCPUs minimum [7] | 4+ vCPUs for parallel experiments |
| RAM (Minikube) | 2 GB minimum [7] | 8 GB+ for multi-service workflows |
| Disk (Minikube) | 20 GB free [7] | 50 GB+ for datasets and images |

## Table 4. Target Kubernetes Server Baseline (Post-Minukube Migration)

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

[9] GitHub guidance on large repositories (recommends <1 GB, strongly recommends <5 GB):  
https://docs.github.com/enterprise-cloud@latest/repositories/working-with-files/managing-large-files/about-large-files-on-github

[10] GitHub Enterprise Server repository limits (10 GB on-disk size guidance):  
https://docs.github.com/en/enterprise-server@3.15/repositories/creating-and-managing-repositories/repository-limits

