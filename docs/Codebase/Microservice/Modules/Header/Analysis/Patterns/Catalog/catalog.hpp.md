# catalog.hpp

- Source: Microservice/Modules/Header/Analysis/Patterns/Catalog/catalog.hpp
- Kind: C++ header

## Purpose

Declares the in-memory shape of the JSON-driven pattern catalog. The microservice is purely structural and pure-algorithm (D20); pattern definitions therefore must be data, not code. This header is the C++ side of the data contract.

## Types

- `PatternStepRepeat` — repetition cardinality for a matcher step (`Once`, `ZeroOrOne`, `ZeroOrMore`, `OneOrMore`).
- `PatternMatcherStep` — one step in an ordered token sequence:
  - `id`, `expected_kind`, `expected_lexeme_any_of`, `one_of` (alternation), `optional`, `repeat`, `capture_as`, `document_as`.
- `PatternTemplate` — a named pattern entry with `id`, `family`, `name`, `enabled`, `scope`, plus one or more ordered token sequences composed of `PatternMatcherStep` values.
- `PatternCatalog` — the loaded, in-memory catalog: `version` plus a list of `PatternTemplate`.

## Free Functions

- `load_pattern_catalog(const std::string& path) -> PatternCatalog` — reads either a single JSON file or a directory of JSON files (recursive). Implementation lives in `Modules/Source/Analysis/Patterns/Catalog/pattern_catalog_parser.cpp`.
- `is_pattern_enabled(const PatternTemplate&) -> bool` — convenience accessor.

## Why It Matters

Adding a new structural pattern is meant to be a "drop a JSON file" operation — no recompile. This header defines the only C++ shape required for that workflow.

## Acceptance Checks

- The header has no dependency on a third-party JSON library. Parsing is hand-rolled inside the matching `.cpp` file to keep the dependency surface minimal.
- Step alternation (`one_of`) and repetition (`repeat`) are expressive enough to encode all currently in-scope structural patterns (Builder, Factory, Singleton, Adapter/Proxy/Decorator family, Method Chaining).
- Pattern matching is structural only. Catalog entries do not encode semantic intent — that is delegated to the AI via the backend (D20).
