# pipeline_state.hpp

- Source: Microservice/Modules/Header/OutputGeneration/Contracts/pipeline_state.hpp
- Kind: C++ header

## Purpose

Declares the single shared state object threaded through every pipeline stage (analysis → trees → pattern dispatch → hashing → output) and the `run_*_stage` function declarations that each stage exposes.

## Types

- `SourcePipelineState` — owns:
  - the resolved CLI arguments and `ParseTreeBuildContext`,
  - the loaded source files,
  - the loaded `PatternCatalog`,
  - the `ParseTreeBundle` (per-file roots, line traces, factory invocations),
  - the merged `main_tree`,
  - the `class_token_streams` produced by the lexer,
  - the `ParseTreeSymbolTables` produced by the symbol-table builder,
  - the `HashLinkIndex` produced by the hashing stage,
  - the running `PipelineReport` accumulator.

## Free Functions

- `run_analysis_stage(SourcePipelineState&)`
- `run_trees_stage(SourcePipelineState&)`
- `run_pattern_dispatch_stage(SourcePipelineState&)`
- `run_hashing_stage(SourcePipelineState&)`
- `run_output_stage(SourcePipelineState&)`

## Why It Matters

The top-level orchestrator (`Modules/Source/core.cpp`) drives the pipeline by calling these stage functions in order. Threading state through one struct avoids global mutable state and keeps each stage testable in isolation.

## Acceptance Checks

- Stages mutate `state` only through their declared concerns. No stage reads or writes fields owned by a later stage during its own execution.
- `run_output_stage` is the only stage that touches the filesystem for output. Earlier stages may read source files but do not write anything to disk.
- The orchestrator captures stage timing into `state.report.stage_metrics` between calls.
