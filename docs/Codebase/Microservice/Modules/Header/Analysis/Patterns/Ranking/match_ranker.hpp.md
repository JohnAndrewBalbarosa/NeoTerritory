# match_ranker.hpp

Header for the connotation-rule candidate filter. See `DESIGN_DECISIONS.md` D38.

## Public surface

```cpp
void rank_pattern_matches(
    std::vector<PatternMatchResult>&     matches,
    const PatternCatalog*                catalog,
    const std::vector<ClassTokenStream>* class_token_streams,
    const ParseTreeSymbolTables*         symbol_tables);
```

The function strictly filters `matches` to those whose pattern's `signature_categories` are all satisfied (lexeme category membership AND per-category grammar rule). No scoring. No ranking. Surviving matches with two or more siblings on the same class get `ambiguous = true`.

## Why this exists

`ordered_checks` in the matcher answers yes/no per pattern but cannot tell `return *this` from a stray `this`, or `return new T()` from a local-variable initialization. The connotation filter rejects "right token, wrong grammatical position" — those are false positives, dropping them is correct.

## Naming note

The directory is `Patterns/Ranking/` for path stability with prior commits. The pass itself does no ranking; it's a filter + ambiguity flag. Renaming the directory is not worth the churn.
