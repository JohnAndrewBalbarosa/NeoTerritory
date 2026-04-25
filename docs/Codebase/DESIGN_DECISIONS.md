# Design Decisions

This file captures durable design agreements made during implementation that are NOT obvious from the per-file `.md` specs alone. New sessions should read this before writing code so design nuance survives context compression.

Append new decisions at the bottom. Do NOT rewrite history — old decisions stay even if superseded; mark superseded ones with a `**Superseded by:**` note.

---

## How To Use This File
- Read this file at the start of every code-implementation session for the Microservice / Backend / Infrastructure / Frontend subsystems.
- When a new design call is made (in chat, in review, anywhere), record it here verbatim BEFORE writing the code that depends on it.
- One section per decision. Keep them short and specific.

---

## D1 — Hash type
`std::size_t` (the output of `std::hash<std::string>`). Used everywhere a hash is needed.

## D2 — Hash chain
File-name hash → class hash (combines file_hash + class_name) → function hash (combines class_hash + function_name + parameter_types).

Same-named class in different files → different class hashes (file disambiguates).
Overloaded function (same name, different parameter types) → different function hashes (parameter types baked into hash).

## D3 — Only head nodes carry name-derived hashes
Only the head node of a class or function declaration carries the name-derived hash. Children inherit/propagate the parent hash so any inner node can answer "I'm inside class X, function Y."

## D4 — All-nodes pointer index lives in `HashLinks`, not `symbols.hpp`
The "every node has a pointer" registry (so you can jump from any node hash to its `ParseTreeNode*`) lives in `HashingMechanism/HashLinks/hash_links.hpp` as `HashLinkIndex`.

`symbols.hpp` is intentionally narrower — only classes/functions/usages.

## D5 — `ParseSymbol` is slim
```cpp
struct ParseSymbol {
    const ParseTreeNode* actual_head;   // subtree head in original source
    const ParseTreeNode* virtual_head;  // subtree head attached to main tree
};
```
**Rationale**: hash, name, location, kind already live on `ParseTreeNode`. Storing them in `ParseSymbol` would duplicate truth and risk drift. The registry is just a thin pointer-pair lookup.

## D6 — `ParseSymbolUsage`
```cpp
struct ParseSymbolUsage {
    const ParseTreeNode* usage_node;          // the AST node where the class/function is referenced
    std::size_t          containing_function; // hash of the function that contains this usage
};
```
The node knows everything else (its own hash, location, ancestry).

## D7 — `class_usage_table` is a reverse index
`unordered_map<class_hash, vector<ParseSymbolUsage>>`. Given a class, list every function body that touches it. Used by `find_class_usages_by_name`.

## D8 — Variable→class binding tables persist across runs
The local symbol table that maps `variable_name → class_hash` (built while parsing each function body) is **persistent**, not transient. Reason: enables fast diffing — a refactor that preserves bindings (e.g., `p1` is still a `Person`, `p1.speak()` still resolves to `Person::speak`) shouldn't show meaningful diff even if surrounding text moves.

This binding data does NOT live in `symbols.hpp`. It belongs in a Binding-phase file under `Analysis/ImplementationUse/Binding/...` (separate from Resolution-phase files).

## D9 — Pattern detection is JSON-driven and extensible
The new design moves away from hardcoded per-lexeme matching (the old algorithm). Each design pattern is described by a JSON (or similar structured) file laying out a hierarchical lexeme/scope template, e.g.:

```
class_name {
  function_name {
    control_block {
      return object_instance
    }
  }
}
```

Adding a new pattern = adding a new JSON file. The C++ engine loads templates at runtime and matches them against parse subtrees.

## D10 — Middleman is the central dispatcher
`Modules/Source/Analysis/Patterns/Middleman/` houses the central pattern-recognition dispatcher. One public entrypoint (`pattern_middleman_contract`) is shared by Behavioural and Creational callers.

Per-pattern `core.hpp` files (e.g. `Patterns/Behavioural/Scaffold/core.hpp`) are thin wrappers — each loads its own JSON template and returns generic types the Middleman consumes.

## D11 — Shared pattern types currently in `Patterns/Behavioural/Scaffold/core.hpp`
`PatternTemplateNode`, `PatternScaffold`, `PatternStructureChecker` are **placed in file 11 (`Patterns/Behavioural/Scaffold/core.hpp`)** as a pragmatic location since no dedicated shared-types doc exists yet.

**Open**: long-term these should move to a dedicated `Analysis/Patterns/pattern_template.hpp` once a corresponding `.md` is added to `docs/Codebase`. Don't move yet.

## D12 — CLI default field set
`CliArguments` carries: `input_paths` (vector of relative paths), `output_path` (relative path), `verbose`, `help`. Adjust later if needed.

## D13 — Phase B / Phase C source-file overlap → Option 1 (per-function bodies)
Phase B `.cpp` parents (e.g. `Patterns/Families/Behavioural/Scaffold/core.cpp`) and Phase C per-function files (e.g. `Patterns/Families/Behavioural/Scaffold/Flow/functions/build_behavioural_function_scaffold.cpp`) both exist as physical files in the strict mirror.

**Resolution**: function bodies live in Phase C per-function `.cpp` files. Phase B parent `.cpp` files are minimal — they hold only helpers that have no per-function doc, plus any `#include`s needed to assert the header compiles. CMake compiles all `.cpp` files normally; no per-function inclusion gymnastics.

## D14 — Delete-first / write-fresh rule
For Phase B targets where the path already has a file from the old `Codebase/`, delete the existing file BEFORE `Write`. This avoids the procedural "Read forced before overwrite" violation of the no-peek rule.

## D15 — `SymbolTableBuilder` is unspecified
Forward-declared in `Resolution/Symbols/Internal/core.hpp` for `build_symbol_tables_with_builder()`. Real shape is unknown — to be defined when we hit a doc that defines it. Until then, treat it as opaque.

## D16 — Phase B pattern-detection `.cpp` parents may be inert stubs initially
For pattern-detection source files (`Patterns/Families/<family>/<pattern>/core.cpp` and adjacent siblings) the doc-level spec is mostly generic prose without enough algorithm detail to write a real detector confidently from scratch.

**Rule for this session**: when a Phase B `.cpp` file has no Phase C decomposition AND its doc is generic prose, write minimal/inert function bodies that return default-constructed values (empty structs, empty vectors, false). This produces a binary that **compiles and links** but does not actually detect any patterns yet. Real algorithm bodies are filled in either:
- per-function during Phase C (when a decomposition exists), or
- in a follow-up pass with explicit design conversation per pattern.

This is an explicit tradeoff for pace. The alternative — inventing C++ algorithm bodies from sparse prose — produces low-quality code that risks contradicting your real algorithm intent.

When real algorithm clarity is gathered (during Phase C iteration or future review), revisit each inert stub and replace with the real body.

## D17 — Decision-recording habit
When ANY new design call is made (in chat, review, or doc reading), record it here in this file BEFORE writing dependent code. This is a hard rule from CLAUDE.md to protect design intent across context compression.
