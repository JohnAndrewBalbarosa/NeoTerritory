# UnitTestGeneration

- Folder: `docs/Codebase/Microservice/Modules/Source/OutputGeneration/UnitTestGeneration`
- Role: future unit-test generation and pipeline acceptance shaping

## Start Here
- `core.cpp.md` is the entrypoint for the output-side orchestration that prepares unit-test-oriented artifacts.

## What Belongs Here
- validation gates
- size or artifact estimation that informs test generation
- normalization or rewrite steps that prepare a stable test target

## What Stays Outside
- documentation tags stay in `../DocumentationTagger/`
- JSON assembly stays in `../Report/`
- HTML or text rendering stays in `../Render/`


