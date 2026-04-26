# core.hpp

- Source: Microservice/Modules/Header/OutputGeneration/UnitTestGeneration/core.hpp
- Kind: C++ header

## Purpose

Declares the unit-test-target extractor used by the pattern dispatcher. Given a matched class's token stream, it identifies every method and every branchable construct (`if`, `else`, `while`, `for`, `switch`, `case`, `do`, `catch`) that lives inside the class body. Each such site becomes one unit-test-target tied to the class's matched pattern.

## Free Functions

- `extract_unit_test_targets(const ClassTokenStream& stream, std::size_t class_hash, const std::string& pattern_id) -> std::vector<UnitTestTarget>`

## Why It Matters

The doc-target / unit-test-target distinction (D-decision) keeps the documentation surface coarse-grained (one per class) while letting the AI write fine-grained verification material (one per method/branch). This file owns the fine-grained side.

## Acceptance Checks

- Method detection requires `Identifier(` at brace-depth 1 inside the class body, not preceded by member-access tokens (`.` or `->`) — so member calls are not misclassified as method declarations.
- Branch detection only fires at brace-depth ≥ 2 (inside a method body), so the class's own opening brace is not counted as a branch site.
- The extractor never reads source text outside the supplied token stream. All evidence travels with the class slice.
