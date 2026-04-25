# pattern_catalog.json

- Folder: `docs/Codebase/Microservice/Modules/Source/Analysis/Patterns/Catalog`
- Role: future data file that stores supported design-pattern definitions and ordered token signatures

## Purpose
This file houses the known pattern structures that automatic recognition should check after class declarations are generated. The catalog replaces the old assumption that the user must provide the source design pattern.

The important requirement is that every generic pattern entry carries enough ordered token information for the parser to cross-reference a completed class against the pattern list.
For extensibility, a pattern entry can describe a nested lexeme layout first and let the middleman or a hook verify the deeper cross-pattern rules later.

## Shape
```json
{
  "version": 1,
  "patterns": [
    {
      "id": "creational.builder",
      "family": "creational",
      "name": "Builder",
      "enabled": true,
      "scope": "class",
      "token_sequences": [
        {
          "id": "builder_class_shape",
          "source": "class_declaration",
          "ordered": true,
          "tokens": [
            { "kind": "class_keyword" },
            { "kind": "identifier", "capture": "builder" },
            { "kind": "open_scope" },
            { "kind": "method_return_type", "capture": "return_type" },
            { "kind": "method_name", "capture": "step_method" },
            { "kind": "open_paren" },
            { "kind": "close_paren" },
            { "kind": "return_statement", "optional": true },
            { "kind": "close_scope" }
          ]
        }
      ],
      "roles": [
        { "id": "builder", "kind": "class", "required": true },
        { "id": "step_method", "kind": "method", "minimum": 1 }
      ],
      "relations": [
        { "from": "builder", "to": "step_method", "kind": "owns" }
      ],
      "evidence": [
        { "kind": "method_chain_or_step_sequence", "weight": 1 }
      ]
    }
  ]
}
```

## Required Fields
- `version`: catalog format version.
- `patterns`: array of supported pattern definitions.
- `id`: stable machine-readable pattern key.
- `family`: broad grouping such as `creational`, `behavioural`, or another supported family.
- `enabled`: default participation in automatic recognition.
- `scope`: matching boundary, usually `class` for class-level checks.
- `token_sequences`: ordered lexical or structural tokens that can identify the pattern shape.
- `roles`: structural pieces expected in a candidate.
- `relations`: required relationships between roles.
- `evidence`: evidence hints used by hooks or generic matching.

## Token Sequence Fields
- `id`: stable key for the token sequence inside one pattern.
- `source`: token source such as `class_declaration`, `method_body`, `usage_trace`, or `symbol_table`.
- `ordered`: whether token order is mandatory.
- `tokens`: ordered token matchers.
- `kind`: normalized token name from lexical analysis or structural event generation.
- `capture`: named value captured for later role or relation checks.
- `optional`: token may be absent without rejecting the sequence.
- `repeat`: token or token group may appear more than once.
- `one_of`: acceptable token alternatives for one position.

## Pattern List Cross Reference
Each pattern entry should be treated as a row in the supported pattern list. Recognition walks the list and compares the candidate class token stream against every enabled pattern entry.

If a pattern becomes too complex for a single flat token list, the catalog can express it as a scoped hierarchy of ordered pieces, then leave cross-reference or family hooks to decide whether the candidate belongs in the main tree or a detached virtual branch.

```mermaid
flowchart TD
    N0["Completed class"]
    N1["Read pattern list"]
    N2["Pick pattern"]
    N3["Read token sequence"]
    N4["Compare order"]
    N5["Record evidence"]
    N0 --> N1 --> N2 --> N3 --> N4 --> N5
```

## Initial Catalog Entries
- `creational.singleton`
  - token sequence should look for class declaration, restricted constructor, static instance storage or accessor, and repeated self-type references.
- `creational.factory`
  - token sequence should look for creator function tokens, conditional or mapping tokens, product construction tokens, and product return tokens.
- `creational.builder`
  - token sequence should look for builder class tokens, step method tokens, chained return or accumulated state tokens, and final build method tokens.
- `behavioural.strategy`
  - token sequence should look for interface or base strategy tokens, context-held strategy reference tokens, and delegated call tokens.
- `behavioural.observer`
  - token sequence should look for subject collection tokens, attach or detach method tokens, notify loop tokens, and observer update call tokens.

## Matching Rule
- Every enabled pattern is checked against every completed class declaration unless runtime options explicitly filter it.
- A catalog entry can produce a match when its ordered token sequences and role relations match the candidate.
- If generic rules are not enough, the catalog entry can name a hook that adds pattern-specific evidence.
- The old strict lexeme-by-lexeme check is still valid for small cases, but the catalog should support scoped nested layouts for extensible pattern families.

## Acceptance Checks
- Adding a new structure means adding a new catalog entry first.
- The parser can validate missing fields before recognition starts.
- The catalog carries ordered tokens or token alternatives for parser cross-reference.
- Catalog data can describe expected pattern shape without changing lexical scanning.
