# Codebase Mirror

- Folder: docs/Codebase
- Descendant source docs: 147
- Generated on: 2026-04-23

## Logic Summary
Top-level logical view of the generated codebase mirror. It groups the repository into runtime entrypoints, frontend prototype code, backend service code, infrastructure automation, sample inputs, and the C++ microservice core.

## Child Folders By Logic
### Backend Service
- Backend/ : Backend service surface. This area groups the Express entrypoint, package metadata, and the HTTP runtime internals under src.

### Frontend Prototype
- Frontend/ : Frontend prototype shell. This area groups the browser entrypoint with route fragments, scripts, and styles.

### Infrastructure Automation
- Infrastructure/ : Infrastructure automation and runtime environment assembly for local containerized execution.

### Microservice Core
- Microservice/ : C++ executable and module tree that implement the parser, detector, transform, rendering, and report pipeline.

### Sample Inputs
- Input/ : Top-level sample source files used as manual or research-oriented inputs for the microservice.

## Documents By Logic
### Bootstrap Scripts
- setup.ps1.md : Windows bootstrap wrapper that ensures elevation and delegates to infrastructure automation.
- setup.sh.md : Shell bootstrap entrypoint for non-Windows setup flows.

### Build System
- CMakeLists.txt.md : Builds the NeoTerritory executable from the microservice layer and module sources.
- CMakeSettings.json.md : Stores IDE-oriented CMake configuration defaults.

### Editor Configuration
- CppProperties.json.md : Provides editor include-path and IntelliSense settings.

### Project Notes
- Notes.md : Keeps loose repository-level notes outside the formal docs set.

### Validation Scripts
- test.sh.md : Shell helper for local compile or execution checks.

## Reading Hint
- Read the local file docs first for concrete behavior, then descend into the child folders for narrower subsystem details.

