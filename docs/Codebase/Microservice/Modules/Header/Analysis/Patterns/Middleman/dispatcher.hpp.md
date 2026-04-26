# dispatcher.hpp

- Source: Microservice/Modules/Header/Analysis/Patterns/Middleman/dispatcher.hpp
- Kind: C++ header

## Purpose

Declares the dispatcher that walks every detected class subtree against every enabled `PatternTemplate` in the catalog and produces a flat list of structural matches plus per-match documentation and unit-test target candidates.

## Types

- `PatternDispatchInput` — references to the loaded catalog, the per-class token streams, and the symbol tables.
- `PatternDispatchOutput` — list of `DesignPatternTag` (defined in `OutputGeneration/Contracts/algorithm_pipeline.hpp`), each tag carrying `documentation_targets` and `unit_test_targets`.

## Free Functions

- `dispatch_patterns_against_subtrees(const PatternDispatchInput&) -> PatternDispatchOutput`

## Why It Matters

This is the bridge between the structural matcher and the pipeline report. It is also where the "doc-target = one per matched class, unit-test-target = one per method/branch within the matched class" rule (D-decision) is enforced.

## Acceptance Checks

- The dispatcher emits every matching pattern for a given class — it does not pick a "winner". Disambiguation is delegated to the backend AI per D20.
- Doc-target counts are computed against unique class hashes, not against pattern×class pairs.
- The dispatcher never opens a file. All evidence comes from in-memory class token streams populated upstream by the trees stage.
