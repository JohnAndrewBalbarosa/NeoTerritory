# Claude Scaffold Handoff: SyntacticBrokenAST

This file is a task-specific handoff for Claude.

Do not treat this as a replacement for `CLAUDE.md`. `CLAUDE.md` stays the general instruction file. This file exists only to scope the upcoming scaffold work for the `SyntacticBrokenAST` implementation.

## Intent
Build only the scaffold for the updated `SyntacticBrokenAST` algorithm.

Claude should focus on control-plane boundaries first, not the final deep algorithm. The goal is to make the codebase ready for strict lexical verification, class-local virtual-broken generation, interval diffing, and partial subtree regeneration.

## Algorithm Model

### Initial Parse And Virtual-Broken Lifecycle
- Structural verification happens during lexical analysis.
- Actual parse-tree growth is independent from expected-structure verification.
- Virtual copy and broken AST are the same detached branch.
- The detached virtual-broken branch grows only while the lexical verifier still matches.
- On the first hard mismatch, stop the detached branch for that class immediately.
- The actual tree continues even after virtual-broken generation stops.
- Attach the detached virtual-broken branch only after class success.
- Discard the detached branch on class failure.

### Interval Diffing And Partial Regeneration
- Every auto-check interval re-runs lexical structural analysis for the changed source region.
- Line metadata is not the diffing algorithm. It only locates the affected actual-tree node or subtree.
- Once the affected subtree is known, subtree-level regeneration and comparison begins.
- If the affected actual subtree has a virtual-broken equivalent, regenerate the virtual subtree first.
- After virtual regeneration succeeds, compare the regenerated virtual subtree against the equivalent actual parse subtree.
- Regenerate only the equivalent affected actual nodes, not the whole tree.
- If the changed actual subtree has no virtual-broken equivalent, regenerate that actual subtree directly.
- After direct actual-subtree regeneration, recheck whether it now follows an assigned design structure.
- If it now follows a design structure, create or attach a virtual-broken subtree.
- Refresh hashes only for affected subtree boundaries and dependent ancestors.
- Send a regeneration report forward instead of making output generation infer what changed.

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
- `docs/Codebase/Microservice/Modules/Source/Diffing/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Diffing/AffectedNodeLocator/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Diffing/SubtreeComparison/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Diffing/PatternOwnership/core.cpp.md`
- `docs/Codebase/Microservice/Modules/Source/Diffing/RegenerationPlan/core.cpp.md`

## Highest Focus
Claude should focus most on these areas:
- Make lexical analysis able to refresh structure for a changed interval.
- Make parse-tree nodes carry enough location and branch metadata to find affected subtrees.
- Make the detached virtual-broken lifecycle explicit and class-local.
- Make diffing produce a regeneration plan instead of directly rewriting everything.
- Keep actual parse-tree growth independent from virtual-broken verification.
- Keep compatibility with the current pipeline while the real algorithm is incomplete.

Claude should not focus on these yet:
- Final pattern rule completeness.
- Final subtree equivalence algorithm.
- Final source rewriting.
- Full output regeneration.
- Full hash-link rewrite.

## Scope Rule
Scaffold only.

That means:
- Add types.
- Add state holders.
- Add function declarations.
- Add minimal control-flow wiring.
- Add TODO markers where full behavior still needs deeper implementation.

Do not try to finish every downstream feature in one pass.

## Primary Edit Set

### 0. Diffing Scaffold Contract
Files:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Diffing/core.hpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/Diffing/core.cpp`

Current scaffold status:
- `SourceChangeInterval` exists.
- `LexicalRefreshSummary` exists.
- `AffectedSubtreeRef` exists.
- `PatternOwnershipState` exists.
- `SubtreeDiffResult` exists.
- `DiffRegenerationPlan` exists.
- `plan_interval_subtree_regeneration(...)` exists.

What Claude should adjust:
- Keep this as the main interval diffing entrypoint.
- Replace file-level placeholder lookup with affected subtree lookup once node line metadata exists.
- Make lexical refresh call into the lexical analysis hook instead of only returning a placeholder event.
- Keep this function returning a plan, not performing full regeneration directly.
- Split helper functions later only if they become too large.

Do not do yet:
- Do not implement deep semantic diffing.
- Do not regenerate the whole actual tree by default.
- Do not move hash-link logic into this file.
- Do not make output generation depend on raw line ranges.

### 1. Lexical Verifier Contract
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.hpp`

Focus anchors:
- `CrucialClassInfo`
- `StructuralClassVerifierState`
- `StructuralAnalysisState`
- `record_structural_lexical_event`
- `current_structural_candidate`

What Claude should adjust:
- Extend `CrucialClassInfo` only if verifier-facing pattern metadata is needed.
- Extend `StructuralAnalysisState` so it can own per-class verifier state.
- Add or expose an interval refresh contract for changed source regions.
- Add scaffold declarations for class-start reset, lexical event feed, verifier state query, class-finalization decision, and changed-region lexical refresh.

Reason:
- Interval diffing must reuse lexical structural analysis instead of inventing a second structure scanner.

### 2. Lexical Verifier Implementation
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/Language-and-Structure/lexical_structure_hooks.cpp`

Focus anchors:
- `on_class_scanned_structural_hook`
- `record_structural_lexical_event`
- `should_keep_virtual_broken_branch`
- `current_structural_candidate_ready_to_attach`
- `current_structural_candidate_failed`

What Claude should adjust:
- Keep the current keyword-selection logic as the seed for the verifier.
- Add scaffold-level verifier state transitions for class candidate start, still valid, failed, and finalized.
- Add scaffold-level changed-region lexical refresh behavior for interval diffing.
- Do not make actual parse-tree growth depend on this file.
- This file should only decide whether the detached virtual-broken branch is still allowed to exist for the current class.
- When called from diffing, this file should emit structural signals that help locate the affected subtree.

### 3. Parse-Tree Public Data Model
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/parse_tree.hpp`

Focus anchors:
- `ParseTreeNode`
- `LineHashTrace`
- `ParseTreeBundle`
- `build_cpp_parse_trees`

What Claude should adjust:
- Extend `ParseTreeNode` only if small metadata is needed for actual branch node, detached virtual-broken node, attached virtual-broken node, source line start, source line end, stable node path, or identity for subtree targeting.
- Update `ParseTreeBundle` so the old `shadow_tree` model no longer implies a pure post-filtered copy.
- If a compatibility field must remain for now, mark it clearly as transitional.
- Keep public parse-tree entrypoints stable unless a tiny overload or helper is required.

Reason:
- Interval diffing needs node location metadata so line intervals can identify affected subtrees.

### 4. Internal Parse-Tree Contracts
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/ParseTree/Internal/parse_tree_internal.hpp`

Focus anchors:
- `parse_file_content_into_node`
- detached branch helper declarations
- internal parse state structs

What Claude should adjust:
- Widen internal signatures so lexical verification state and detached virtual-branch state can be threaded through internal parse functions.
- Add scaffold declarations for start detached class branch, append detached branch node, finalize detached branch, and release detached branch.
- Add scaffold declarations for locate affected subtree by interval, regenerate actual subtree placeholder, and regenerate virtual subtree placeholder.
- Keep symbols and hash-links contracts out of this change unless strictly necessary.

Reason:
- Diffing needs tree helpers, but those helpers should belong to tree contracts rather than the diffing coordinator itself.

### 5. Top-Level Parse-Tree Orchestration
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/core.cpp`

Focus anchors:
- `build_cpp_parse_trees`
- `main_tree`
- `shadow_tree`
- `virtual_tree_scaffold`

What Claude should adjust:
- Preserve `main_tree` as the rooted source truth.
- Stop presenting the secondary tree as only a post-pass relevance filter.
- Add scaffold-level orchestration for file-root ownership, detached virtual-broken collection per file, attach-on-success path, and discard-on-failure path.
- If the old post-pass filtered copy must remain temporarily, fence it as compatibility behavior and do not let it define the new architecture.

### 6. Actual Parse Loop And Class Lifecycle
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/build.cpp`

Focus anchors:
- `parse_file_content_into_node`
- class or struct declaration handling
- scope-enter and scope-exit handling
- lexical event emission

What Claude should adjust:
- Keep actual node growth rooted in `file_node`.
- Feed lexical events into verifier state during scanning.
- Record source location metadata on class/function nodes where safe.
- Add scaffold state for active class candidate, detached virtual-broken branch buffer, failed current class candidate, and class boundary reset.
- Do not route `Build actual class subtree -> Check expected structure`.
- The expected-structure check should control only the detached virtual-broken branch.
- On failure, stop detached growth immediately, leave actual growth alone, and reset detached state only at the next class boundary.

Reason:
- Diffing depends on this file eventually producing reliable affected-subtree metadata.

### 7. Diffing Integration With Tree And Lexical Scaffolds
Files:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Diffing/core.hpp`
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/Diffing/core.cpp`
- tree helper declarations added in `ParseTree/Internal/parse_tree_internal.hpp`
- lexical refresh declarations added in `Language-and-Structure/lexical_structure_hooks.hpp`

What Claude should adjust:
- Keep `plan_interval_subtree_regeneration(...)` as the public coordinator.
- Call lexical refresh first for every interval.
- Use line metadata only to locate affected nodes, not to classify the diff.
- Call tree helpers to locate the smallest safe affected subtree.
- Classify pattern ownership based on virtual-broken equivalent presence and refreshed structure signals.
- Return `DiffRegenerationPlan` with actions for virtual regeneration, actual regeneration, hash refresh, and output notification.

### 8. Old Relevance Filter Quarantine
File:
- `Codebase/Microservice/Modules/Source/SyntacticBrokenAST/ParseTree/Internal/relevance.cpp`

Focus anchors:
- `append_shadow_subtree_if_relevant`

What Claude should adjust:
- Do not fully rewrite this unless required.
- Mark this path as compatibility or transitional if the new scaffold no longer wants virtual-broken generation to be treated as pure relevance filtering.
- If needed, add a narrow TODO comment or wrapper rename inside the code to signal that this is not the final virtual-broken model.

## Secondary Edit Set

### Build-Context Extension Point
File:
- `Codebase/Microservice/Modules/Header/SyntacticBrokenAST/Pipeline-Contracts/analysis_context.hpp`

Adjust only if needed.

Possible use:
- scaffold fields for verifier mode
- strict-structure policy flags
- interval auto-check mode

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
- pattern-specific logic files under `Codebase/Microservice/Modules/Source/Behavioural`
- pattern-specific logic files under `Codebase/Microservice/Modules/Source/Creational`

Reason:
- The scaffold should first establish lexical verification, actual-tree independence, detached virtual-broken lifecycle, and interval regeneration planning.
- Symbol, hash-link, pipeline, output, and pattern logic can be adapted after the scaffold surfaces exist.

## Edit Priority
1. `Diffing/core.hpp` and `Diffing/core.cpp`
2. `lexical_structure_hooks.hpp`
3. `lexical_structure_hooks.cpp`
4. `parse_tree.hpp`
5. `parse_tree_internal.hpp`
6. `ParseTree/Internal/build.cpp`
7. `ParseTree/core.cpp`
8. `ParseTree/Internal/relevance.cpp`
9. `analysis_context.hpp` only if needed

## Guardrails For Claude
- Do not let the actual parse tree look derived from the virtual copy.
- Do not move structural verification out of lexical analysis.
- Do not make the detached virtual-broken branch file-global if the lifecycle is class-local.
- Do not rewrite hash-links or symbols in the same scaffold pass.
- Do not treat line ranges as the diffing algorithm.
- Do not regenerate the whole tree when a subtree target is available.
- Do not make `Diffing/` own lexical scanning, tree building, hashing, or output rendering.
- Prefer thin scaffold structs and helper functions over one giant function rewrite.

## Suggested Scaffold Deliverable
Claude's scaffold pass should leave the codebase with:
- a lexical verifier state carrier
- a class-local detached virtual-broken branch carrier
- explicit attach-or-discard boundaries
- node metadata sufficient for affected-subtree targeting
- top-level parse-tree orchestration that no longer treats the secondary branch as only a late relevance filter
- an interval diffing coordinator that returns a `DiffRegenerationPlan`
- placeholder tree regeneration hooks for actual and virtual subtrees
- placeholder scoped hash refresh and output notification actions
- TODO markers where the final strict rule catalog still needs expansion

## Anchor Rule
Use function and struct anchors as the authority if line numbers drift:
- `StructuralAnalysisState`
- `on_class_scanned_structural_hook`
- `record_structural_lexical_event`
- `ParseTreeNode`
- `ParseTreeBundle`
- `parse_file_content_into_node`
- `append_shadow_subtree_if_relevant`
- `build_cpp_parse_trees`
- `plan_interval_subtree_regeneration`
- `DiffRegenerationPlan`
