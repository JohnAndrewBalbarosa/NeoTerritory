# AST Pipeline Step Map

## Scope

This document is split into two phases:

1. **Phase A**: implemented now.
2. **Phase B**: future extension only (not implemented in code).

The format is plain Markdown so it can be converted with Pandoc.

## Current Hashing Type (Implemented)

The system currently uses **non-cryptographic `std::hash<std::string>` composition**.

- It is used for contextual node hashes (`parent + kind + value + sibling_index`).
- It is used for class-name hashes (`hash(class_name)`).
- It is used for file-aware class identity (`hash(file_path + "|" + class_name)`).
- It is used for function keys (`hash(file_path + "|" + owner_scope + "|" + function_name + "|" + parameter_hint)`).
- It is used for line propagation chains (`hash(prev_hash + "|" + token)`).

Notes:

- This is **not SHA-256** and **not cryptographic**.
- Rationale in current code: fast lookup and lightweight symbol indexing.

### Specific Algorithm Detail (RRL-Ready)

For your current local compiler/toolchain (`g++ 15.2.0`, libstdc++ on MSYS2/UCRT64):

1. The code calls `std::hash<std::string>`.
2. In libstdc++, `hash<string>` routes to `std::_Hash_impl::hash(...)`.
3. `std::_Hash_impl::hash(...)` calls `_Hash_bytes(ptr, len, seed)`.
4. Default seed in this path is `0xc70f6907UL`.

Important limitation for write-up:

- `_Hash_bytes` is an internal libstdc++ primitive whose exact algorithm is **implementation-defined** and can change between library releases.
- So the most accurate statement is:
  "The project uses libstdc++ `std::hash<std::string>` (via `_Hash_impl` / `_Hash_bytes`), not a fixed cryptographic algorithm such as SHA-256."

Reference files from your local toolchain:

- `C:/msys64/ucrt64/include/c++/15.2.0/bits/basic_string.h` (`hash<basic_string<...>>`)
- `C:/msys64/ucrt64/include/c++/15.2.0/bits/functional_hash.h` (`_Hash_impl`)
- `C:/msys64/ucrt64/include/c++/15.2.0/bits/hash_bytes.h` (`_Hash_bytes` notes)

### Documentation Links (for RRL citations)

Primary mechanism docs (official libstdc++ API/source pages):

1. `functional_hash.h` (`_Hash_impl`, default seed `0xc70f6907UL`):
   <https://gcc.gnu.org/onlinedocs/gcc-15.1.0/libstdc++/api/a00800_source.html>
2. `basic_string.h` (`hash<string>` delegates to `_Hash_impl::hash(...)`):
   <https://gcc.gnu.org/onlinedocs/gcc-15.1.0/libstdc++/api/a00650_source.html>
3. `hash_bytes.h` (states `_Hash_bytes` may change, `_Fnv_hash_bytes` is stable FNV):
   <https://gcc.gnu.org/onlinedocs/gcc-15.1.0/libstdc++/api/a00350_source.html>

Toolchain/version context:

4. GCC 15.2 release information:
   <https://gcc.gnu.org/gcc-15/>
5. GCC 15.2 source release archive:
   <https://gcc.gnu.org/pub/gcc/releases/gcc-15.2.0/>

Examples showing why hashing internals get updated:

6. libstdc++ `_Hash_bytes` correctness fix for large lengths (PR89629):
   <https://gcc.gnu.org/pipermail/libstdc++/2019-March/048378.html>
7. libstdc++ `_Hash_bytes` portability fix for I16LP32 targets (PR107885):
   <https://gcc.gnu.org/pipermail/libstdc++/2022-November/055116.html>

### Why the Hashing Mechanism Gets Updated

From libstdc++'s own `hash_bytes.h` comments and maintenance history:

1. **Quality and speed tuning**:
   `_Hash_bytes` is intentionally allowed to change to improve hash distribution and performance.
2. **Correctness fixes**:
   updates are applied when edge cases produce incorrect behavior (for example, very large input lengths).
3. **Portability/architecture safety**:
   updates fix undefined behavior or integer-width issues on less common architectures.

Practical implication for this project:

- Your current hashing path is tied to your current libstdc++ build.
- It is reliable for in-process lookup, but should not be treated as a permanent cross-version fingerprint format.

### Hashing Theory Framing (for Panel Defense)

If asked "what exact hashing theory/algorithm is used?", the most accurate answer is:

1. **C++ standard level**:
   `std::hash` is specified as a hash function object with behavioral requirements (equal keys must hash equally), but the exact algorithm is **not standardized**.
2. **Toolchain level (your current setup)**:
   in libstdc++ 15.x, `std::hash<std::string>` calls `_Hash_impl::hash(...)`, which calls `_Hash_bytes(...)` with seed `0xc70f6907UL`.
3. **Algorithm naming level**:
   `_Hash_bytes` is intentionally implementation-defined and may change; therefore you should describe it as a **seeded non-cryptographic byte-mixing hash used for hashtable indexing**, not as a fixed named cryptographic primitive.

In other words, your implementation follows this practical theory:

- **Hash family type**: non-cryptographic, seeded byte-sequence hashing.
- **Design goal**: fast average-case lookup for hash tables, acceptable distribution (low accidental clustering), and ABI/runtime practicality.
- **Complexity**: `O(L)` per token/string where `L` is input length.
- **Security property**: not collision-resistant in the cryptographic sense.

Contrast that with libstdc++'s explicit FNV path:

- `_Fnv_hash_bytes` is documented as FNV-based and stable across releases.
- `std::hash<std::string>` in your current path does **not** use that stable FNV path directly; it uses `_Hash_bytes`.

## Phase A (Implemented)

### A1. CLI and Context Entry

- CLI accepts:
  - `argv[1]`: source design pattern
  - `argv[2]`: target design pattern
  - `argv[3..]`: one or more file paths
- Parse context is initialized from CLI before parsing.

References:

- `Project/Modules/Source/SyntacticBrokenAST/cli_arguments.cpp`
- `Project/Layer/Back system/syntacticBrokenAST.cpp`

### A2. Root and File-Level Separation

- Parse trees use a root node (`TranslationUnit` / `"Root"`).
- Immediate children are `FileUnit` nodes (one per input file).
- Files stay separated in memory (no forced merge for parsing).

References:

- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`build_cpp_parse_trees(...)`)
- `Project/Modules/Header/SyntacticBrokenAST/parse_tree.hpp`

### A3. Dual-Tree Build

- Two trees are produced:
  - `main_tree` (full AST-like structure)
  - `shadow_tree` (virtual filtered tree)
- Shadow tree keeps only pattern-relevant branches.

References:

- `Project/Modules/Header/SyntacticBrokenAST/parse_tree.hpp` (`ParseTreeBundle`)
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp`

### A4. File-Aware Class Hash Registration During Lexing

- Class names are hashed immediately during lexical pass.
- Hashing keeps:
  - class name hash (`hash(class_name)`)
  - file-aware contextual hash (`hash(file_path + "|" + class_name)`)
- Class-hit traces store file path and matched class contextual hash.

References:

- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`register_classes_in_line(...)`)
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`token_hits_registered_class(...)`)
- `Project/Modules/Header/SyntacticBrokenAST/parse_tree.hpp` (`LineHashTrace`)

### A5. Scope Propagation Hashing

- Parent contextual hash is propagated to child nodes.
- Usage hashes are propagated per lexical scope.
- Outgoing line hash traces are recorded for class-hit lines.

References:

- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`derive_child_context_hash(...)`)
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`collect_line_hash_trace(...)`)

### A6. Explicit Traversal Buckets Per File

- Each `FileUnit` now has explicit traversal buckets:
  - `ClassDeclarations`
  - `GlobalFunctionDeclarations`
- This separation is applied to both main and shadow trees.

References:

- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`bucketize_file_node_for_traversal(...)`)

### A7. Function Symbol Overload Support (Signature-Aware Key)

- Function symbols are no longer indexed by name only.
- New function identity key includes:
  - file path
  - owner scope (class name or `global`)
  - function name
  - parameter hint
- This prevents same-name overload collisions across scopes/files.

References:

- `Project/Modules/Header/SyntacticBrokenAST/parse_tree_symbols.hpp` (`ParseSymbol`)
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree_symbols.cpp` (`build_function_key(...)`)
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree_symbols.cpp` (`add_function_symbol(...)`)

### A8. Symbol API Extensions

- Existing API remains:
  - `getClassByName(...)`
  - `getFunctionByName(...)`
- Added API:
  - `getFunctionByKey(...)`
  - `getFunctionsByName(...)`

References:

- `Project/Modules/Header/SyntacticBrokenAST/parse_tree_symbols.hpp`
- `Project/Modules/Source/SyntacticBrokenAST/parse_tree_symbols.cpp`

### A9. Shadow Tree Function-Relevance Filter

- Shadow population uses:
  - usage hashes
  - tracked class names
  - tracked function names (owned by tracked classes)
- Global function bucket keeps only relevant subtrees.

References:

- `Project/Modules/Source/SyntacticBrokenAST/parse_tree.cpp` (`append_shadow_subtree_if_relevant(...)`)

## Phase B (Future Feature, Not Implemented)

Phase B is intentionally left as a future extension. No code in this step implements these items.

### B1. Cryptographic Hash Mode

- Optional SHA-256/BLAKE3 mode for deterministic cross-platform fingerprints.
- Keep current fast `std::hash` mode as default.

### B2. Optional Reverse-Merkle Chain

- Add explicit parent-seeded chain objects for selective scopes.
- This is separate from current contextual hash propagation.

### B3. Explicit Dirty-Bit Token Objects

- Materialize dirty-bit state as token/node metadata structs.
- Current implementation uses propagated usage hash vectors instead.

### B4. Pattern-Specific Hash Namespaces

- Separate hash namespaces by pattern family (`creational`, `behavioural`, `structural`).
- Prevent accidental cross-pattern key reuse.

### B5. Persistent Symbol Store

- Optional symbol serialization/reload across runs.
- Useful for incremental scans on large multi-file projects.

## One-Pass Intent Status

Current behavior already aligns with one-pass lexical-first intent:

- class scanning and structural hook execution happen during lexical parse
- usage propagation is computed during the same pass
- symbol tables are rebuilt from final tree once structure is complete

This keeps the parser pipeline simple while preserving modular pattern logic.
