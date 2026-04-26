# matcher.hpp

- Source: Microservice/Modules/Header/Analysis/Patterns/Catalog/matcher.hpp
- Kind: C++ header

## Purpose

Declares the pure-structural matcher that runs one `PatternTemplate` against one `ClassTokenStream` and returns whether the structure matches plus the captured anchors and documentation hints.

## Types

- `PatternCapture` — one captured token slot from a successful match (`name`, `lexeme`, `line`).
- `PatternDocumentationAnchor` — one anchor that a matched step requested via its `document_as` field. The dispatcher later turns these into doc-targets and unit-test-targets.
- `PatternMatchResult` — `matched` (bool), `pattern_id`, `class_hash`, `captures`, `anchors`.

## Free Functions

- `match_pattern_against_class(const PatternTemplate&, const ClassTokenStream&) -> PatternMatchResult`

## Why It Matters

This is the single entry point that turns "JSON catalog entry + class tokens" into "structural verdict + evidence". It is the only matcher in the system; new patterns reuse it without code changes.

## Acceptance Checks

- Matching is order-preserving inside one token sequence and supports backtracking only for `one_of` alternation.
- Sub-sequence matching: a pattern step set need not start at token 0 of the class — the matcher scans forward to find the first viable starting position.
- Multiple matches across patterns are not deduplicated here; the dispatcher emits every match (D-decision: structural patterns are not mutually exclusive).
- The matcher never reads source text — it operates strictly on `LexicalToken` lexeme/kind comparisons.
