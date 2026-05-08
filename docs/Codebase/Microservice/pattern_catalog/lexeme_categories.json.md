# lexeme_categories.json

Connotative lexeme dictionary used by the candidate-filter pass. See `DESIGN_DECISIONS.md` D38.

## Discipline (hard rule)

A single-token entry in a category is permitted ONLY when the token is a well-known standard library API symbol (`std::make_unique`, `std::lock_guard`, `std::unique_ptr`, ...).

A bare reserved C++ keyword or operator (`static`, `this`, `->`, `virtual`, `new`, `delete`, `==`, ...) MUST appear inside a multi-token combo and never as a single-token entry. Reasoning: one keyword carries too little context — every class with `virtual` somewhere would tag as polymorphic, every class with `delete` would tag as a destruction signal, every class with `->` would tag as forwarding. The combo (e.g. `["virtual", "~"]`, `["=", "delete"]`, `["return", "*", "this"]`) is what gives the connotation enough specificity to be a real signal.

Convention-driven names (`m_inner`, `inner`, `wrapped`, `target`, `wrappee`, `delegate`, `impl`, `m_impl`, `cache`, `cached`, `getInstance`, `sharedInstance`, `build`, `create`, `make`, `finalize`, `instance`, ...) are excluded entirely — those are user choices, not language facts.

## Schema

```json
{
  "schema_version": 2,
  "description": "...",
  "categories": {
    "<category_name>": [
      "<stdlib_symbol>",
      ["<lex1>", "<lex2>", ...]
    ],
    ...
  }
}
```

Each entry is either a single-token combo (single string, only allowed for stdlib symbols) or an ordered combo of consecutive token lexemes (JSON array of strings).

## Categories shipped

| Category | Combos |
|---|---|
| `object_instantiation` | `make_unique`, `make_shared`, `std::make_unique`, `std::make_shared`, `allocate_shared`, `std::allocate_shared`, `["return", "new"]` |
| `static_storage_access` | `call_once`, `std::call_once`, `once_flag`, `std::once_flag` |
| `self_return` | `["return", "*", "this"]` |
| `interface_polymorphism` | `["virtual", "~"]`, `["virtual", "void"]`, `["virtual", "bool"]`, `["virtual", "int"]`, `["virtual", "std"]`, `["virtual", "auto"]`, `["override", "{"]`, `["override", ";"]`, `["override", "const"]`, `["final", "{"]`, `["=", "0"]` |
| `access_control_caching` | stdlib synchronization symbols (`std::mutex`, `std::lock_guard`, `std::call_once`, `std::condition_variable`, `std::atomic`, …) |
| `ownership_handle` | stdlib smart pointers (`std::unique_ptr`, `std::shared_ptr`, `std::weak_ptr`) |
| `destruction_signal` | `["=", "delete"]` |

## Loaded by

`pattern_catalog_parser.cpp`'s `load_lexeme_categories`, invoked once during `load_pattern_catalog` when the file is found at `pattern_catalog/lexeme_categories.json` (depth 0). Missing or malformed → empty `PatternCatalog::lexeme_categories` and the candidate filter degrades silently (every match passes through).
