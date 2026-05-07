# lexeme_categories.json

Connotative lexeme dictionary used by the candidate-filter pass. See `DESIGN_DECISIONS.md` D38.

## Discipline

Entries MUST be one of:
1. C++ keywords (`static`, `virtual`, `override`, `final`, `delete`, `this`, ...).
2. C++ operators / punctuation (`->`, `==`, `~`, ...).
3. Symbols from well-known standard library APIs (`std::make_unique`, `std::lock_guard`, `std::call_once`, `std::shared_ptr`, ...).

Variable names, naming conventions, and project-specific identifiers (`m_inner`, `inner`, `wrapped`, `target`, `wrappee`, `delegate`, `impl`, `m_impl`, `cache`, `cached`, `getInstance`, `sharedInstance`, `build`, `create`, `make`, `finalize`, `instance`, ...) are intentionally excluded — those are user choices, not language facts. Reading them as pattern signals is what produced the original over-tagging.

If a real pattern signal cannot be expressed as keywords / operators / stdlib symbols, it belongs in a Round-2-style structural predicate inside `match_ranker.cpp`, not here.

## Schema

```json
{
  "schema_version": 1,
  "description": "...",
  "categories": {
    "<category_name>": [ "<lexeme>", ... ],
    ...
  }
}
```

## Categories shipped

- `object_instantiation`
- `static_storage_access`
- `self_return`
- `delegation_forward`
- `interface_polymorphism`
- `access_control_caching`
- `ownership_handle`
- `value_comparison`
- `destruction_signal`

Each category has a per-category grammar predicate in `match_ranker.cpp`. A category without a grammar predicate defaults to "presence anywhere in the class" — used for stdlib-symbol categories where presence is already structurally meaningful.

## Loaded by

`pattern_catalog_parser.cpp`'s `load_lexeme_categories`, invoked once during `load_pattern_catalog` when the file is found at `pattern_catalog/lexeme_categories.json` (depth 0). Missing or malformed → empty `PatternCatalog::lexeme_categories` and ranker degrades silently.
