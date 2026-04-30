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

## D23 — Implementation-template + cross-reference ranking lives in the backend, not the microservice
The pattern catalog JSON gains optional fields that describe the *implementation/usage shape* of a pattern (callsites, expected collaborators, global functions, negative signals). These fields refine pattern detection beyond the class-declaration-only signal currently emitted by the microservice — important for behavioural patterns and for disambiguating co-emitted shapes (Adapter vs Proxy vs Decorator per D21).

**Why backend, not microservice**: per D20, the microservice stays pure-algorithm and deterministic. Putting the cross-reference / scoring / ambiguity logic into the C++ engine would couple structural detection to heuristic scoring, brittle regex, and stateful user-prompt flow. The new fields are silently ignored by the microservice (it only reads `ordered_checks`).

**Schema additions** (all optional):
```jsonc
{
  "implementation_template": {
    "callsites":              [{ "id", "shape_regex", "weight", "describe" }],
    "expected_collaborators": [{ "id", "shape_regex", "weight", "describe" }],
    "global_functions":       [{ "id", "name_regex",  "weight", "describe" }],
    "negative_signals":       [{ "id", "shape_regex", "weight": <negative>, "describe" }]
  },
  "ranking_weights": { "class_fit": 0.55, "implementation_fit": 0.45 }
}
```
- `shape_regex` may contain `{class_name}` as a literal placeholder — the backend substitutes it with the matched class name from microservice output before compiling the regex.
- Weights sum convention: positive ranges [0..1] additive, capped at 1.0; negative_signals subtract.

**Ranking pipeline** (lives in `Codebase/Backend/src/services/patternRankingService.js`):
1. Load all catalog JSONs at startup.
2. For each `detectedPattern` from microservice → fetch matching catalog entry → compute `class_fit` (=1.0 because the microservice already matched the class shape; this preserves a meaningful ceiling for future refinement).
3. Compute `implementation_fit` by running each `shape_regex` (with `{class_name}` substituted) against the source text and summing weighted hits, clamped to [0,1].
4. `final_rank = ranking_weights.class_fit * class_fit + ranking_weights.implementation_fit * implementation_fit`.

**Verdict thresholds**:
- `final_rank >= 0.85` → confident, auto-accept
- top-2 within `Δ <= 0.10` → ambiguous, ask user via the frontend (one-shot per run, not persisted across runs)
- all `< 0.50` → emit `"no_clear_pattern"` advisory (do not silently downgrade microservice's detection — the structural class match still stands)

**Ambiguity prompt UX**: frontend renders a chooser modal listing the candidate patterns with each pattern's score breakdown and a "Confirm pattern" button. The user's choice is attached to the run's analysis JSON as `userResolvedPattern: "<pattern_id>"` and is forwarded to Claude as ground truth (Claude is told "user has confirmed this is X" so it doesn't second-guess).

**Backwards compat**: existing seven catalog files (per D21) work unchanged — they're treated as `class_fit` only, so `final_rank == ranking_weights.class_fit`. Patterns that author the new fields get the richer ranking automatically. Behavioural family is not yet authored; schema lands first, content lands per pattern as authored.

**Initial rollout**: only `structural/adapter.json` ships the new schema in the first PR to validate the loader and UI. Other catalogs are extended pattern-by-pattern as the schema settles.

## D24 — Backend-side class-usage binder is INTERIM until C++ Binding phase lands
Per D7/D8 the authoritative source for "which function bodies use which class" is `class_usage_table` populated in the C++ Binding phase. Per D18 those bodies are inert stubs today, so the table is empty in production output.

Until that work lands, the backend ships a **heuristic** variable→class usage binder at `Codebase/Backend/src/services/classUsageBinder.js` that scans the source text using the class names already returned by the microservice. This unblocks the frontend "Tagged usages" UI and gives Devcon testers something to validate against.

**Scope of the heuristic**:
- Value/reference/pointer declarations: `<Class> v;`, `<Class>& r;`, `<Class>* p;`
- Smart-pointer declarations: `unique_ptr<<Class>> v;`, `shared_ptr<<Class>> v;`
- Member calls on declared variables: `v.method(`, `p->method(`
- Qualified static calls: `<Class>::method(`
- Constructor calls: `make_unique<<Class>>(`, `make_shared<<Class>>(`, `new <Class>(`

**Out of scope (intentional)**:
- `auto x = make<Foo>()` — no type inference.
- Typedef / `using` aliases.
- Cross-translation-unit binding.
- Templates with deduced types, lambdas with inferred captures.

**Surface contract**:
- Backend response gains a top-level `classUsageBindings: { "<ClassName>": [{ line, kind, varName, methodName, boundClass, snippet, evidence }] }`.
- The frontend pattern cards look up usages by the pattern's `className` and render under a labelled section "Tagged usages [heuristic]" so the heuristic origin is honest.
- When the C++ Binding phase lands, the microservice output gains `class_usages`. Backend then prefers microservice data and the heuristic fallback is reduced to "fill the gaps for classes the microservice doesn't bind." The frontend tag flips to "[microservice-bound]" when authoritative data is present.

**Removability**: the binder is a single backend file plus one route enrichment line. To delete the interim path: drop the file, remove the require + the one-line call site, drop the section block in `Frontend/app.js`. Microservice and pattern catalog are not touched.

## D25 — Roles + seeded admin account
The `users` table gains a `role TEXT NOT NULL DEFAULT 'user'` column. JWT payload and the `/auth/login` response carry `role` so the frontend can route immediately on login.

**Seeded admin** (one row, created on first DB init if missing): `username = 'Neoterritory'`, `role = 'admin'`, `password = process.env.SEED_ADMIN_PASSWORD || 'ragabag123'` (bcrypt-hashed at seed time). The hardcoded default exists per explicit user request for the research deployment; production may rotate via env without code change.

**Admin gate**: `Codebase/Backend/src/middleware/requireAdmin.js` runs after `jwtAuth` and `403`s if `req.user.role !== 'admin'`. Every `/api/admin/*` route mounts both.

**Why a single seeded admin instead of registration self-elevation**: there is exactly one admin in this research tool; registration self-elevation widens attack surface for no functional gain.

## D26 — Review questions are XML-driven, decoupled from code
The review questionnaire shown to users is **NOT** hardcoded in the frontend. Questions live in `Codebase/Backend/src/reviews/questions.xml` with two scopes (`per-run`, `end-of-session`) and are parsed at server start. The file is `fs.watch`ed; edits hot-reload without server restart.

**Why**: the user is a researcher. Question wording and ordering will change as the study evolves. Decoupling questions from code lets non-engineers iterate on the instrument without redeploying.

**Schema** (v1): `<reviewQuestions version="1">` containing one or more `<scope id="...">` elements, each containing `<question id type required>` with a child `<prompt>`. Supported `type` values are `rating` (with `max` attr), `text` (with `maxLength`), and `choice` (with nested `<option value>label</option>` — wired but unused in seed).

**Robustness**: parser uses `fast-xml-parser`, validates against an explicit JS shape, and keeps the last-good schema in memory. A malformed edit logs and is rejected — runtime keeps serving the previous schema.

**Storage**: new `reviews` table stores submissions. `scope`, `analysis_run_id` (NULL for end-of-session), `answers_json`, `schema_version` (copied from XML `version` attr so downstream analysis can correlate answer sets to instrument versions).

**Two-tier UX** (per user direction):
- **Per-run**: a quick 5-star accuracy rating renders inline below each `/api/analyze` result. Non-blocking — user can skip.
- **End-of-session**: a longer questionnaire (overall usefulness, UI clarity, missed patterns, suggestion) appears once before logout if at least one analyze ran in the session and no end-of-session review was submitted yet.

## D27 — Admin aggregation lives in the Node backend (Python remains an option, contract is JSON)
Per D20 the backend is the sole external-integration adapter. Admin dashboard aggregates (counts, time-series, histograms) are computed in the **Node backend** by reducing rows from `analysis_runs`/`logs`/`reviews` in JS. The dataset is single-machine research scale; SQL window functions or a separate analytics store are not justified.

**Frontend animation, not server-rendered images**: backend returns aggregate JSON; `Codebase/Frontend/admin.js` renders animated charts via Chart.js 4.x (CDN). User wanted "appealing" animation; Chart.js entrance animations + rAF count-up tweens + IntersectionObserver section reveals deliver this with no Python dependency.

**Future Python offload (per user note)**: if richer statistical visualizations are needed later, the aggregation source can be swapped to a Python service that returns the **same JSON shape**. Chart.js stays in the browser. The contract worth preserving is the per-endpoint JSON shape (`runs-per-day`, `pattern-frequency`, `score-distribution`, `per-user-activity`), not the implementation language.

## D28 — Pattern catalog lexeme expansion stays additive; naming hints land in `implementation_template`, not in the C++ matcher

**Superseded by:** D29.

Originally I attempted to disambiguate patterns by widening `expected_lexeme_any_of` lists and adding `implementation_template.shape_regex` entries that matched naming conventions (`class \w*Builder`, `target_`, `s_instance`, `(get|Get)?[Ii]nstance`, etc.). This was wrong: those rules are arbitrary, depend on developer naming style, and conflate "class is named like a Factory" with "class behaves like a Factory." The user explicitly rejected this approach — it is not algorithmic, and a class named `FooBar` that behaves exactly like a Factory would score lower for no real reason. All naming-heuristic `shape_regex` entries have been removed; see D29 for the replacement.

## D29 — Pattern evidence is discretized via `evidence_rules`, grounded in language tokens and STL types only

Catalog entries no longer carry `implementation_template` regex blocks (with the exception of Adapter, which still has its long-standing `expected_collaborators` adaptee-arg shape). Instead each pattern carries an `evidence_rules` array, where every entry is a **typed, discretized predicate** the parse tree / symbol table can answer with a yes-or-no:

```json
"evidence_rules": [
  { "id": "deleted_copy_ctor",            "kind": "deleted_method",   "method": "copy_ctor",       "polarity": "positive" },
  { "id": "static_local_self_in_method",  "kind": "static_local",     "of_type": "{class_name}",   "polarity": "positive" },
  { "id": "constructs_via_make_unique",   "kind": "stl_call",         "callee": "std::make_unique", "polarity": "positive" },
  { "id": "owns_smart_ptr_to_base",       "kind": "owning_member_of_base_type", "smart_ptr": ["unique_ptr","shared_ptr"], "polarity": "positive" },
  { "id": "pure_virtual_present",         "kind": "pure_virtual_count","min": 1,                   "polarity": "positive" },
  { "id": "no_data_members",              "kind": "non_static_data_member_count","max": 0,         "polarity": "positive" }
]
```

**Discretization invariant**: every `kind` is a question the parse tree can answer deterministically. No regex over identifier text. No "class name ends in X." A signal either fires (yes) or doesn't (no). The JS ranker becomes a pure logic combinator over yes/no signals.

**Vocabulary of `kind` values** (the analyzer must implement detection for each — initially in C++ for the existing analyzer, and per language for future analyzers under `Analyzers/<Language>/`):

| `kind` | What it answers |
|---|---|
| `token_pattern` | Does an exact token sequence (e.g. `["virtual", "...", "=", "0"]`) appear in the class body? |
| `stl_call` | Is there a call to `std::make_unique` / `std::make_shared` / etc., optionally constrained to a `type_arg`? |
| `deleted_method` | Is `copy_ctor` / `copy_assign` / `move_ctor` / `move_assign` `= delete`? |
| `defaulted_method` | Same shape with `= default`. |
| `static_local` | Is there a `static T name` inside a method body, with `T` matching a captured type? |
| `static_member` | Is there a static data member of a given type (optionally pointer/ref)? |
| `pure_virtual_count` | How many `virtual ... = 0` methods does the class have? `min` / `max` filter. |
| `non_static_data_member_count` | Count of non-static data members. `min` / `max` filter. |
| `override_specifier_count` | How many methods carry `override`? |
| `final_specifier_on_class` | Is `final` applied to the class? |
| `inheritance_present` | Does the class inherit from any base? |
| `inherits_from_member_type` | Does the class inherit from the type of one of its members? (positive for some patterns, negative for Adapter.) |
| `non_self_class_member` | Does the class hold a member of a non-self class type? |
| `owning_member` / `owning_member_of_self_type` / `owning_member_of_base_type` | Does the class hold a `unique_ptr<T>` / `shared_ptr<T>` of a relevant type? |
| `self_reference_return` | Does any method declared return type equal `Self&` or `Self*`? |
| `method_forwards_to_member` | Does any method body delegate via `.` or `->` to a member? |
| `null_check_then_construct_member` | Does any method body do `if (!member_)` then construct `member_`? |
| `control_flow_then_construction` | Does any method body branch (`if`/`switch`) and then construct via `new` / `make_unique`? |
| `return_type_smart_ptr` | Does any method's declared return type include `unique_ptr<...>` or `shared_ptr<...>`? |
| `terminator_method_with_distinct_return` | Does the class have a method whose return type is NOT `Self&`/`Self*`? |
| `friend_class` | Does the class declare a `friend class X`? |

**Polarity**: `"positive"` adds confidence when the rule fires; `"negative"` adds confidence when the rule does NOT fire (or subtracts when it does — the ranker decides).

**C++ side**: a new evidence-extraction pass under `Codebase/Microservice/Modules/Source/Analysis/Patterns/Evidence/` runs once per detected class and emits `evidence_signals: { "<class_name>": { "<rule_id>": true|false|count } }` in the report JSON. The C++ pattern catalog parser already silently ignores unknown JSON fields (verified against all 10 existing fixtures — zero detection drift after the schema change).

**JS / TS side**: `patternRankingService` (being ported to TypeScript) consumes `evidence_signals` only. No regex compilation. A pattern's `finalRank` is a function of `count(positive_rules_fired) / count(positive_rules) - count(negative_rules_fired) / count(negative_rules)`, clamped. Deterministic, explainable, replayable.

**Multi-language hook**: the `evidence_rules` vocabulary is conceptual. C++ implements `pure_virtual_count` via `virtual ... = 0`; a future Java analyzer implements it via `abstract`; a future Python analyzer via `@abstractmethod`. The catalog says what signal it wants; each language's analyzer decides how to detect it.

**Why this is "super safe and strict"**: every signal has one true value at one moment in time, regardless of who wrote the code or what they named anything. A class behaves like a Singleton if and only if `deleted_copy_ctor` AND (`static_local_self_in_method` OR `static_self_member_pointer`) — three discrete questions, three discrete answers, no naming guesswork.

**Backwards compatibility**: existing `ordered_checks` (the C++ matcher's all-or-nothing token-sequence gate) are unchanged. The matcher still decides "is this class shape a candidate"; `evidence_rules` decide "among candidate patterns, which one is it." The only widened lexeme list (`creational/builder.json:build_terminator`) was reverted to its original two-element form — Builder disambiguation now happens through `evidence_rules`, not through identifier-name widening.

## D30 — Backend migrates to TypeScript with strict + no-implicit-any from day zero

`Codebase/Backend/` is migrating from CommonJS JavaScript to TypeScript. The migration is gradual (`allowJs: true`, per-file rename), but new strictness is applied immediately to every TS file: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `useUnknownInCatchVariables`. ESLint adds `@typescript-eslint/no-explicit-any: error` and `no-floating-promises: error`.

**Phase 0 (this commit)**: tooling installed at `Codebase/Backend/`. `tsconfig.json` and `tsconfig.build.json` written. `.eslintrc.cjs` configured. `npm run typecheck` / `npm run lint` / `npm run build` scripts added. No JS files renamed yet — everything still runs as before.

**Phase 1 (this commit)**: canonical types directory landed at `Codebase/Backend/src/types/` (`api.ts`, `analysis.ts`, `auth.ts`, `catalog.ts`, `seat.ts`, `index.ts`). `npm run typecheck` is green. All future TS code imports from here.

**Phase 2 onward (next stages)**:
- Stage 2 of `may-problem-ako-pure-brooks.md` (seat-key backend) lands directly in TypeScript — `seatKeyService.ts`, `seatController.ts`, `auth.ts` (route), `jwtAuth.ts`, `devconUsers.ts`. The seat-key types in `types/seat.ts` already encode the "private key returned once, never persisted" invariant at the type level.
- Stage 3 (frontend heartbeat) lands as TypeScript on the frontend after a Vite-style toolchain install (separate from the backend).
- Existing JS gets ported behind new work in dependency order (utils → db → services → middleware → controllers → routes → entrypoint).

**Multi-language posture**: `PatternEntry.language` in `types/catalog.ts` is a closed string-literal union (`'cpp' | 'java' | 'python' | 'go' | 'typescript'`). Adding a new language requires changing this union, which forces a compile error everywhere the dispatcher needs to handle it. This is what "multi-language ready" looks like at the type level.

**Manual surface posture**: `PatternEntry.manual_documentation_template`, `manual_review_checklist`, and `manual_test_scaffold` are first-class fields on the catalog schema. The backend's manual-mode services (to be implemented next) read these directly when `aiProviderConfigured` is false. AI is augmentation; absent AI, the manual templates ARE the surface.

## D31 — JWT migrates from HS256 to ES256 with auto-generated keypair and JWKS endpoint

The backend signs auth tokens with ECDSA P-256 (ES256) instead of a shared HMAC secret. Rationale: the C++ microservice and any future verifier must be able to validate tokens **without** holding the signing secret. With HS256, anyone who can verify can also forge. With ES256, only the backend that holds the private key can sign; verifiers only need the public key, which is published at `/auth/jwks` (standard JWK Set format).

**Key lifecycle**:
- On first boot, `src/utils/jwtKeys.js` generates a P-256 keypair into `Codebase/Backend/keys/jwt-private.pem` and `keys/jwt-public.pem` (gitignored).
- File mode `0600` on the private key. Subsequent boots reload from disk.
- The `kid` (key id) is the SHA-256 fingerprint of the public JWK, included in every token's header. JWKS responses carry the same `kid` so verifiers can match.
- Override paths via `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` for production-managed keys.

**Verification fallback**: during rollout, `jwtAuth` middleware first tries ES256 with the loaded public key; on failure, falls back to HS256 with `process.env.JWT_SECRET` if set. This allows legacy tokens to keep working until the 30-day expiry window passes. Once all clients have re-authenticated, `JWT_SECRET` can be removed.

**JWKS shape** (returned by `GET /auth/jwks`):
```json
{ "keys": [{ "kty": "EC", "crv": "P-256", "x": "...", "y": "...", "kid": "...", "use": "sig", "alg": "ES256" }] }
```

**Token claim addition**: alongside the existing `id`, `username`, `email`, `role` claims, tokens now carry `sub` (string form of `id`) for OIDC-style downstream consumers.

**No external dep added**: keypair generation, PEM ↔ JWK conversion, and signing all use Node's built-in `crypto` and the existing `jsonwebtoken` package (which supports ES256 natively).

## D32 — AI provider switches from Anthropic Claude to Google Gemini (gemini-2.0-flash)

The AI documentation pass (`aiDocumentationService.js`) targets Google's Gemini API instead of Anthropic. Rationale: cost. Free tier on `gemini-2.0-flash` (1500 req/day, 15 RPM) covers research-mode workload at zero spend; Anthropic has no comparable free tier. Quality for this use case (JSON-structured documentation paragraphs, no creative writing) is more than sufficient.

**Provider contract preserved**: `generateDocumentation(input)` signature is unchanged. Callers in `routes/analysis.js` and consumers of `aiByPattern[*]` see the same `{ status, verdict, finalPatternId, rationale, documentationByTarget, unitTestPlanByTarget, providerMetadata }` shape regardless of which model produced the result. This is the D22 stance reaffirmed: backend is the only adapter; the frontend never knows which provider is upstream.

**Env vars**:
- `GEMINI_API_KEY` (replaces `ANTHROPIC_API_KEY`)
- `GEMINI_MODEL` defaults to `gemini-2.0-flash` (replaces `ANTHROPIC_MODEL`)
- Old Anthropic vars are no longer read; if a deployment still has them set, they are ignored without error.

**Health/status surface**: `/api/health` reports `aiProviderConfigured`, `aiModel`, and now `aiProvider: 'gemini'` so the frontend can show "AI: Gemini · gemini-2.0-flash" in admin diagnostics.

**Response coercion**: Gemini's `generateContent` is configured with `generationConfig.responseMimeType = "application/json"` to force structured output. The parser still tolerates accidental code-fence wrappers via the same `extractJsonFromContent` helper, since Gemini occasionally backslides into prose for malformed prompts.


## D33 — Strategy pattern minimum implementationFit threshold

`behavioural.strategy_interface` and `behavioural.strategy_concrete` fire too easily on plain polymorphic inheritance hierarchies (Vehicle→Car→Truck). Root cause: the evidence rules for these two patterns match any abstract base class with pure virtuals and any derived class with overrides — i.e., any use of run-time polymorphism, not just the Strategy design pattern.

**Fix**: `patternRankingService.js` introduces `PATTERN_MIN_IMPL_FIT`:
```js
const PATTERN_MIN_IMPL_FIT = {
  'behavioural.strategy_interface': 0.85,
  'behavioural.strategy_concrete':  0.80,
};
```
If `implementationFit` falls below the floor for that pattern, `finalRank` is forced to 0. The rank entry is still returned (for diagnostic display) with `suppressedByMinFit: true`. This prevents confident false-positive detection without removing the pattern from the catalog or requiring a C++ microservice recompile.

**Tradeoff**: legitimate Strategy patterns that lack a visible Context class in the same file may now score below the threshold. The AI reclassification step is the intended fallback for ambiguous cases.

## D34 — GDB execution queue

The backend provides a GDB execution service (`gdbService.js`) that compiles and runs user C++ code. GDB is a shared resource (only one process can safely run at a time on a single machine). An in-memory FIFO queue serializes requests. Job state lives in a `Map` with 10-minute TTL eviction. Clients poll `GET /api/gdb/job/:id` every 2 seconds and receive `{ status, queuePosition, result }`.

Queue is not persisted — server restart clears it. Acceptable for the research-tool scope (D20 principle: single-machine, no HA needed).

## D35 — Async pipeline: parallel AI + ranking + binding

Previously `routes/analysis.js` ran AI documentation, pattern ranking, and class usage binding sequentially after the C++ microservice step. These three operations are all independent (each needs only `detectedPatterns` + `sourceText`). Wrapped in `Promise.all`, they run concurrently, cutting wall-clock time to `max(AI latency, ranking latency, binding latency)` instead of the sum.

Timing data for each step is returned in `analysis._timing: { structuralMs, parallelMs, annotationsMs, totalMs }`. A dev-only endpoint `GET /api/analyze/timing-report` exercises the sample file and reports a formatted breakdown.
