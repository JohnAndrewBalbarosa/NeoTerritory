# Claude Scaffold Handoff: SyntacticBrokenAST

This file is a task-specific handoff for Claude.

Do not treat this as a replacement for `CLAUDE.md`. `CLAUDE.md` stays the general instruction file. This file exists only to scope the upcoming scaffold work for the `SyntacticBrokenAST` implementation.

## Intent
Build only the scaffold for the updated `SyntacticBrokenAST` algorithm.

The scaffold must reflect this model:
- structural verification happens during lexical analysis
- actual parse-tree growth is independent from expected-structure verification
- virtual copy and broken AST are the same detached branch
- the detached virtual-broken branch grows only while the lexical verifier still matches
- on the first hard mismatch, stop the detached branch for that class immediately
- the actual tree continues
- attach the detached virtual-broken branch only after class success
- discard the detached branch on class failure

## Read These Docs First
- `docs/Codebase/Microservice/Modules/Source/main.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Analysis/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Analysis/Lexical/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Analysis/Lexical/StructureVerification/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Trees/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Trees/MainTree/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Trees/ClassGeneration/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Trees/ClassGeneration/VirtualBroken/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Trees/ClassGeneration/Attachment/core.cpp.md`

## Scope Rule
Scaffold only.

That means:
- add types
- add state holders
- add function declarations
- add minimal control-flow wiring
- add TODO markers where full behavior still needs deeper implementation

Do not try to finish every downstream feature in one pass.

## Primary Edit Set

### 1. Lexical verifier contract
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.hpp`

Target lines:
- `10-37`

What Claude should adjust:
- extend `CrucialClassInfo` if needed so it can carry verifier-facing pattern metadata
- extend `StructuralAnalysisState` so it can own per-class verifier state, not only `crucial_classes`
- add scaffold declarations for:
  - class-start reset
  - lexical event feed
  - verifier state query
  - class-finalization decision

Reason:
- this is the narrowest existing contract for lexical structural logic
- current contract only registers crucial classes and is too thin for the new strict verifier lifecycle

### 2. Lexical verifier implementation
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.cpp`

Target lines:
- `14-149`
- highest-priority region: `87-149`

What Claude should adjust:
- keep the current keyword-selection logic as the seed for the verifier
- add scaffold-level verifier state transitions around:
  - class candidate start
  - class candidate still valid
  - class candidate failed
  - class candidate finalized
- do not make actual parse-tree growth depend on this file
- this file should only decide whether the detached virtual-broken branch is still allowed to exist for the current class

Reason:
- this is where strict structural verification already begins today
- the scaffold should evolve this file into the lexical fail-fast gate instead of moving that logic downstream

### 3. Parse-tree public data model
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/parse_tree.hpp`

Target lines:
- `12-20`
- `51-60`
- `71-73`

What Claude should adjust:
- extend `ParseTreeNode` only if a small metadata flag is needed for:
  - actual branch node
  - detached virtual-broken node
  - attached virtual-broken node
- update `ParseTreeBundle` so the old `shadow_tree` model no longer implies a pure post-filtered copy
- if a compatibility field must remain for now, mark it clearly as transitional
- keep the public parse-tree entrypoints stable unless a tiny overload or helper is required for the scaffold

Reason:
- the current bundle still centers the older `shadow_tree` shape
- the docs now define a detached virtual-broken lifecycle instead

### 4. Internal parse-tree contracts
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/Internal/parse_tree_internal.hpp`

Target lines:
- `56-60`
- `88-104`

What Claude should adjust:
- widen the internal signatures so lexical verification state and detached virtual-branch state can be threaded through internal parse functions
- add scaffold declarations for helper boundaries such as:
  - start detached class branch
  - append detached branch node
  - finalize detached branch
  - release detached branch
- keep the symbols/hash-links contracts out of this change unless strictly necessary

Reason:
- this is the control-plane header for internal parse-tree mechanics
- if the scaffold does not define these boundaries here, implementation will become ad hoc inside `build.cpp`

### 5. Top-level parse-tree orchestration
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/core.cpp`

Target lines:
- `29-187`
- highest-priority regions:
  - `33-52`
  - `77-89`
  - `157-185`

What Claude should adjust:
- preserve `main_tree` as the rooted source truth
- stop presenting the secondary tree as only a post-pass relevance filter
- add scaffold-level orchestration for:
  - file-root ownership
  - detached virtual-broken collection per file
  - attach-on-success path
  - discard-on-failure path
- if the old post-pass filtered copy must remain temporarily, fence it as compatibility behavior and do not let it define the new architecture

Reason:
- this is the top source entry for tree assembly
- it currently creates `main_tree` and `shadow_tree` as parallel rooted trees too early for the new model

### 6. Actual parse loop and class lifecycle
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/build.cpp`

Target lines:
- `214-389`
- highest-priority regions:
  - `223-232`
  - `262-320`
  - `322-389`

What Claude should adjust:
- keep actual node growth rooted in `file_node`
- feed lexical events into verifier state during scanning
- add scaffold state for the current class lifecycle:
  - active class candidate
  - detached virtual-broken branch buffer
  - failed current class candidate
  - class boundary reset
- do not route `Build actual class subtree -> Check expected structure`
- the expected-structure check should control only the detached virtual-broken branch
- on failure:
  - stop detached growth now
  - leave actual growth alone
  - wait until the next class boundary before resetting detached state

Reason:
- this is the real place where lexical events, scope movement, and actual tree growth happen together
- this file needs the scaffold most

### 7. Old relevance filter quarantine
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/relevance.cpp`

Target lines:
- `30-105`

What Claude should adjust:
- do not fully rewrite this unless required
- mark this path as compatibility or transitional if the new scaffold no longer wants virtual-broken generation to be treated as pure relevance filtering
- if needed, add a narrow TODO comment or wrapper rename inside the code to signal that this is not the final virtual-broken model

Reason:
- this file currently encodes the older “append shadow subtree if relevant” idea
- the new algorithm is stricter and class-lifecycle-driven, not only relevance-pruning-driven

## Secondary Edit Set

### 8. Build-context extension point
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts/analysis_context.hpp`

Target lines:
- `7-12`

Adjust only if needed.

Possible use:
- scaffold fields for verifier mode or strict-structure policy flags

Do not touch this file unless the scaffold truly needs explicit context knobs.

## Files Claude Should Avoid For This Scaffold
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/symbols.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/symbols_builder.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/symbols_queries.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/symbols_utils.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/hash_links.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/hash_links_collect.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/hash_links_common.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/hash_links_resolve.cpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/Pipeline-Orchestration/algorithm_pipeline.cpp`
- pattern-specific logic files under `Codebase/Microservice/Modules/Source/Behavioural` and `Codebase/Microservice/Modules/Source/Creational`

Reason:
- the scaffold should first establish lexical verification, actual-tree independence, and detached virtual-broken lifecycle
- symbol, hash-link, pipeline, and pattern logic can be adapted after the scaffold surfaces exist

## Edit Priority
1. `lexical_structure_hooks.hpp`
2. `lexical_structure_hooks.cpp`
3. `parse_tree_internal.hpp`
4. `parse_tree.hpp`
5. `ParseTree/Internal/build.cpp`
6. `ParseTree/core.cpp`
7. `ParseTree/Internal/relevance.cpp`
8. `analysis_context.hpp` only if needed

## Guardrails For Claude
- do not let the actual parse tree look derived from the virtual copy
- do not move structural verification out of lexical analysis
- do not make the detached virtual-broken branch file-global if the lifecycle is class-local
- do not rewrite hash-links or symbols in the same scaffold pass
- prefer thin scaffold structs and helper functions over one giant function rewrite

## Suggested Scaffold Deliverable
Claude’s scaffold pass should leave the codebase with:
- a lexical verifier state carrier
- a class-local detached virtual-broken branch carrier
- explicit attach-or-discard boundaries
- top-level parse-tree orchestration that no longer treats the secondary branch as only a late relevance filter
- TODO markers where the final strict rule catalog still needs expansion

## Line Number Rule
Use the line ranges above as the starting target.

If line numbers drift, the function or struct anchors named in each section are the authority:
- `StructuralAnalysisState`
- `on_class_scanned_structural_hook`
- `ParseTreeBundle`
- `parse_file_content_into_node`
- `append_shadow_subtree_if_relevant`
- `build_cpp_parse_trees`
