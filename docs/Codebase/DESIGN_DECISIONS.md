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

## D18 — Phase C empty placeholders + Phase B holds inert bodies (refines D13)
**Problem found while starting Phase C**: with 485 untouched Phase C files, leaving them empty would cause linker failures because Phase B parents declared functions but didn't define them (deferring to "with decomp" Phase C).

**Resolution**: Phase B parent `.cpp` files (even those with Phase C decomposition) hold **inert default bodies** for every function declared in their matching Phase B header. Phase C function `.cpp` files are kept as **empty placeholders** until real algorithm work moves a body into them.

**Migration rule**: when real algorithm work fills a Phase C function file with a real body, you MUST simultaneously delete that function's inert body from the Phase B parent to avoid double-definition.

This refines D13 — D13 said "minimal" parents; D18 clarifies "minimal = inert bodies, not no bodies."

## D19 — Phase C `.hpp` files are pure pass-throughs
Per-function `.hpp` files in `Flow/functions/` (Phase C) carry zero real declarations — those live in the parent header. Phase C `.hpp` files become single-line `#pragma once` placeholders.

## D20 — Microservice is pure-algorithm; backend is the sole external-integration adapter
The C++ microservice never makes network calls and never depends on AI providers, secret stores, or other external services. It only reads source files and writes structural artifacts to disk. The **backend server is the sole adapter** between the microservice's structural output and any external system (AI agents, databases beyond `analysis_runs`, telemetry, dashboards).

**Rationale**:
- **Determinism**: structural detection produces the same output for the same input, regardless of network state or model version.
- **Reproducibility**: researchers can share `report.json` + `evidence/` and reproduce documentation pipelines without running C++.
- **Provider-agnostic**: AI provider is TBD; swapping providers requires zero microservice change.
- **Smaller attack surface**: C++ binary holds no API keys, ships without TLS/network stack, easier to audit.
- **Replay/caching**: backend can re-feed cached microservice outputs to a different AI without re-detection.

**Implication on output contract**: microservice output must be self-sufficient so that backend (and the AI it orchestrates) never need the original source again. Per matched class, the microservice writes:
- `outputs/<run>/report.json` — structural facts only: detected_patterns, doc-targets, unit-test-targets, evidence-file pointers (no inline code blobs).
- `outputs/<run>/evidence/<class_hash>__<pattern_id>.cpp` — virtual-copy slice containing the class **declaration** and **implementation** text, plus per-method token excerpts for each unit-test-target. This is the only artifact the backend ships to the AI for a given match.

**Implication on backend**: the backend spawns the microservice as a child process (or reads its outputs from disk if pre-run), reads `report.json`, follows evidence-path pointers, and is the only component that builds AI prompts or calls external services. The microservice codebase must contain zero references to AI vendors, HTTP clients, or prompt templates.

**Implication on the current placeholder analyzer (`Codebase/Backend/src/services/analyzer.js`)**: this regex-scoring service is **dud / experimental**. It is not the intended long-term shape and is intentionally **not doc-locked** in `docs/Codebase/Backend/`. It will be replaced with a microservice-spawning + AI-orchestrating adapter once the AI provider is chosen. Until then, only stable backend pieces (server bootstrap, db, middleware, transform routes, frontend shell) are mirrored into `docs/Codebase/`.

## D21 — Initial pattern catalog locked at seven entries
The first iteration of `pattern_catalog/` ships seven patterns:

- **Creational**: `creational.singleton`, `creational.factory`, `creational.builder`, `creational.method_chaining`
- **Structural**: `structural.adapter`, `structural.proxy`, `structural.decorator`

**Co-emit pairs** (deliberate, per D20):
- `creational.builder` and `creational.method_chaining` both match any class with fluent setters returning `*this`. Builder additionally requires a `build` / `Build` identifier; if absent, only Method Chaining matches. If present, both match.
- `structural.adapter`, `structural.proxy`, and `structural.decorator` all match the same wrapping signature (a class that forwards a call to a member via `.` or `->`). All three emit when the shape matches; backend AI disambiguates which role the wrapping serves.

**Each catalog entry is one JSON file under `Codebase/Microservice/pattern_catalog/<family>/<pattern>.json`**. Adding a new pattern is a "drop a JSON file and rerun" operation — no C++ recompile is required.

**Reference samples and negative controls** live under `Codebase/Microservice/samples/<pattern>/` and `Codebase/Microservice/samples/integration/all_patterns.cpp`. The integration sample exercises every pattern in one source file and serves as the regression contract: any future change to the matcher or the catalog must keep the integration sample's detection set stable.

**Known limitations of this iteration**:
- Patterns are forward-scan token sequences. A signature whose tokens appear out of canonical order (e.g., a `build()` declared above its fluent setters) may miss the Builder match and be classified as Method Chaining only. This is acceptable per D20: the AI sees the structural facts and can reclassify.
- The wrapping-family signature is intentionally permissive: any class that does `obj.method(` or `obj->method(` will match all three of Adapter/Proxy/Decorator. This is by design — the AI decides which wrapping role it actually plays based on the class text and surrounding context.
- The current catalog targets idiomatic C++ implementations (Meyer's Singleton, branching `create`/`make`, `*this` fluent return, member-pointer wrappers). Stylistic deviations may need additional pattern variants.

## D22 — AI provider: Anthropic Claude (Sonnet 4.6 default)
Per D20, the backend is the sole external-integration adapter. The AI provider chosen for the first integration is **Anthropic Claude**, defaulting to model `claude-sonnet-4-6`.

**Why Anthropic Claude**:
- Strong code-comprehension and structured-output behavior, which fits the disambiguation + documentation task.
- Already part of the existing development workflow (this project is built with Claude Code), so the operator already has a key path and quota visibility.
- Single HTTP endpoint via the Messages API — implementable with built-in `fetch` in Node 18+, no SDK dependency required.

**Model selection policy**:
- Default model: `claude-sonnet-4-6` (good price/latency/quality balance for documentation work).
- Override: `ANTHROPIC_MODEL` env var. Recommended overrides: `claude-opus-4-7` for higher-quality batches, `claude-haiku-4-5-20251001` for cheaper bulk runs.

**Auth**:
- API key read from `ANTHROPIC_API_KEY` env var.
- If the key is missing, `aiDocumentationService.generateDocumentation()` returns `{status: "pending_provider", reason: "ai_provider_not_configured", payload}` and the run still completes — the structural facts and evidence files are returned to the frontend so the user can ship them to the AI manually if desired. This preserves the determinism guarantee of D20.

**Prompt shape**:
The backend builds a single Messages API request per detected pattern. The user message contains:
- The detected pattern id, family, and name (the structural verdict from the microservice).
- The class name and file name.
- The full class text slice from `evidence/<class_hash>__<pattern_id>.json` (the virtual-copy slice).
- The captured documentation anchors (label + line + lexeme).
- The unit-test targets (function name + branch kind + line).

The system prompt instructs the model to:
1. Confirm or reclassify the structural verdict (since several patterns are intentionally co-emit).
2. Emit per-anchor documentation paragraphs.
3. Emit per-unit-test-target test-design notes.
4. Return a single JSON object so the result is machine-parseable.

**Replacement of `analyzer.js`**:
The regex-based `services/analyzer.js` is removed. Its endpoints in `routes/analysis.js` are rewritten to drive `classDeclarationAnalysisService.js` (spawn microservice) and `aiDocumentationService.js` (call Claude). API surface stays the same so the Frontend continues to work without changes:
- `POST /api/analyze`
- `GET  /api/runs`, `GET /api/runs/:id`
- `GET  /api/runs/:id/export?format=...`
- `GET  /api/sample`, `GET /api/health`

**Microservice binary discovery**:
- Default path: `Codebase/Microservice/build/NeoTerritory.exe` on Windows, `.../NeoTerritory` elsewhere.
- Override: `NEOTERRITORY_BIN` env var.
- Catalog path default: `Codebase/Microservice/pattern_catalog`. Override: `NEOTERRITORY_CATALOG` env var.
- If the binary is missing, the run returns a diagnostic and `status: "microservice_unavailable"`. No fallback to regex analysis (the regex analyzer is gone — D20 says structural detection is the microservice's job, not the backend's).
