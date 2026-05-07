# match_ranker.cpp

Implementation of the connotation-rule candidate filter declared in `match_ranker.hpp`. See `DESIGN_DECISIONS.md` D38 for the design contract.

## Flow

1. Build a reverse index `lexeme -> [categories]` from `catalog->lexeme_categories`.
2. For each `PatternMatchResult`:
   - Look up its `PatternTemplate` and its `ClassTokenStream`.
   - If `signature_categories` is empty → keep the match (legacy pattern, not opted in).
   - Else → for every declared category, run the per-category grammar predicate against the class's tokens. ALL must return true (strict AND) for the match to survive.
3. Group survivors by `class_hash`. Any class with ≥2 survivors → set `ambiguous = true` on each survivor.

## Per-category grammar predicates

| Category | Predicate |
|---|---|
| `object_instantiation` | category-member token preceded (lookback ≤ 3) by `return` keyword |
| `self_return` | strictly the trigram `return * this` |
| `delegation_forward` | `->` operator preceded by an Identifier (excludes trailing-return-type `() -> T`) |
| `destruction_signal` | `delete` keyword preceded by `=` (the `= delete` form, not delete-expressions) |
| `static_storage_access` | presence anywhere — keyword `static` + stdlib `std::call_once`/`std::once_flag` |
| `interface_polymorphism` | presence anywhere — keywords `virtual` / `override` / `final` |
| `access_control_caching` | presence anywhere — stdlib synchronization symbols only (`std::mutex`, `std::lock_guard`, `std::call_once`, ...) |
| `ownership_handle` | presence anywhere — stdlib smart pointer symbols only (`std::unique_ptr`, `std::shared_ptr`, ...) |
| `value_comparison` | presence anywhere — comparison operators (reserved; not currently consumed) |

## Adding a new grammar predicate

1. Add the lexeme list to `pattern_catalog/lexeme_categories.json` under a new category name (must respect the stdlib-only / keyword / operator discipline — no convention names).
2. Add a per-category predicate function in this file, plus a branch in `category_satisfied`.
3. Reference the new category from any pattern JSON via `signature_categories`.

## Symbol table

Currently unused; reserved for future predicates that need parse-tree facts (e.g. "held member type is also a declared base class").
