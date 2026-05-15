# Complexity Audit — NeoTerritory C++ Microservice

_Source of truth for this audit is the per-stage code at `Codebase/Microservice/Modules/Source/`. The thesis claims in Sections 3.4.1 and 3.4.2 (per `_thesis_work3/plain.txt`) are summarised at the top so each stage can be evaluated against them._

## Thesis claim being audited

| Property | Claim | Where in thesis |
|---|---|---|
| Pattern catalog size | Fixed → treated as constant `P` | line 757, 777, 822 |
| Hashing | O(1) amortized per item | line 764 |
| Total time | Linear in size of submitted source-code structure | line 781 |
| Total space | Linear in size of submitted source-code structure | line 826 |

The thesis's simplified bound is `O(K + L)` time and `O(L)` space, where `K` = number of submitted files and `L` = total relevant lexical tokens / structural elements. `P` (number of pattern checks) and `E` (number of classes / structural sub-units) are treated as bounded constants for the prototype.

## Pipeline entry

`Codebase/Microservice/Modules/Source/core.cpp:19-59` — five stages run in order, then a small bookkeeping fold:

1. `run_analysis_stage` (`core.cpp:39`)
2. `run_trees_stage` (`core.cpp:40`)
3. `run_pattern_dispatch_stage` (`core.cpp:41`)
4. `run_hashing_stage` (`core.cpp:42`)
5. `run_output_stage` (`core.cpp:56`)

Plus a between-stage fold over `state.report.detected_patterns` to count documentation / unit-test targets (`core.cpp:46-54`).

## Per-stage verdicts

### Stage 1 — `run_analysis_stage` (input read + catalog load)

- Reads all `K` files into `SourceFileUnit.contents` (linear in bytes).
- Loads the pattern catalog from disk once (fixed-size, treated as constant `P`).
- No nested traversal; single linear pass over input data.

**Time**: O(L). **Space**: O(L) (file contents retained for downstream stages). **Verdict**: `matches`.

### Stage 2 — `run_trees_stage` (tokenization + structural representation)

- One tokenization pass per file (`tokenize_cpp_source`): linear in `L_file`.
- Brace-matching and class extraction iterate the token stream once per class but every position is visited a bounded number of times in aggregate, so the per-file cost remains O(L_file).
- Per-method re-tokenization in the symbol resolver walks each method body once; summed across the whole tree this is bounded by the total token count.

**Time**: O(L) with a constant-factor overhead from the repeated tokenization. **Space**: O(L) — parse-tree nodes + per-class token streams. **Verdict**: `cosmetic` — the redundant tokenization is a constant-factor blemish, not a super-linear regression. Linearity claim holds.

### Stage 3 — `run_pattern_dispatch_stage` (pattern matching + ranking)

- `match_pattern_against_class()` scans the class token stream once per pattern's ordered checks. The number of ordered checks per pattern, and the number of patterns in the catalog, are both bounded by the catalog (constant `P`). Summed over all classes, the per-pattern matching is **O(L · P)** — linear in `L` once `P` is a constant.
- Subclass propagation reuses the same matcher on each child class once per matching parent pattern. Bounded by the inheritance fan-out and the number of patterns — again constant-bounded.
- **One spot of concern**: the tag-construction loop performs a linear scan over `class_token_streams` to find the stream that matches each match (`pattern_hook_dispatcher.cpp`, `for match in output.matches { for stream in class_token_streams { ... } }`). Worst-case that is `O(E²)` if every class triggers a match. In real submissions `E` is small (tens), so this is a measurable constant overhead, not a complexity-class regression. Replacing the inner scan with the existing `streams_by_name` hash map would drop it to `O(E)`.

**Time**: O(L · P) for the matcher; O(E²) for the unoptimised tag-construction inner scan; with `P` constant and `E ≤ L`, total is bounded by `O(L + E²)`. For practical input sizes `E²` is dominated by `L`. **Space**: O(E · P) accumulated matches before filtering; well within O(L). **Verdict**: `cosmetic` — the linearity claim still holds asymptotically, but the tag-construction loop should be flagged for a follow-up rewrite (hash-indexed lookup). It is NOT a thesis correctness issue.

### Stage 4 — `run_hashing_stage` (content-addressed hashing)

- `index_all_nodes()` is a single tree walk: O(E) where E is the number of tree nodes (≤ O(L)).
- Each hash insert/lookup is on `std::unordered_map` — O(1) amortised.
- Outer loop over classes (O(E)) + inner loop over per-class usage list (sums to O(L) overall).

**Time**: O(E + L) = O(L). **Space**: O(E) hash index entries (≤ O(L)). **Verdict**: `matches`.

### Stage 5 — `run_output_stage` (JSON report)

- Walks `state.report.detected_patterns` (size bounded by E · P with P constant, so O(E) ≤ O(L)).
- String-escaping is linear in the emitted string length, which is bounded by L.

**Time**: O(L). **Space**: O(L) for the output buffer. **Verdict**: `cosmetic` — output cost scales linearly with what was detected; no super-linear blow-up.

### Between-stage fold (`core.cpp:46-54`)

- Single pass over `detected_patterns`; `unordered_set<size_t>` insert is O(1) amortised.

**Time**: O(detected_patterns) = O(E · P) = O(E). **Space**: O(E). **Verdict**: `matches`.

## Summary table

| Stage | Time | Space | Verdict |
|---|---|---|---|
| 1 `run_analysis_stage` | O(L) | O(L) | matches |
| 2 `run_trees_stage` | O(L) (× constant for double-tokenization) | O(L) | cosmetic |
| 3 `run_pattern_dispatch_stage` | O(L · P) + O(E²); `P` constant, `E ≤ L` | O(E · P) | cosmetic |
| 4 `run_hashing_stage` | O(L) | O(L) | matches |
| 5 `run_output_stage` | O(L) | O(L) | cosmetic |
| Fold (core.cpp:46-54) | O(E) | O(E) | matches |
| **Total** | **O(L)** under `P, E ≤ L`, `P` constant | **O(L)** | **consistent with thesis** |

## Decision

Per the plan's decision tree:

- No stage is `wrong`.
- Two stages have `cosmetic` blemishes (redundant tokenization in stage 2; the unoptimised `O(E²)` tag-construction inner scan in stage 3). Neither contradicts the thesis's "linear with respect to the size of the submitted source-code structure" claim.

**No `FINAL THESIS 3 PAPER.docx` edit is required.** The thesis derivations are correct under the stated assumptions (fixed pattern catalog, bounded structural-element count) — but it is honest to flag the two cosmetic items to the thesis author so they can be optionally mentioned in a "future work / optimization" paragraph in Chapter 5 (or simply left as-is, since they don't change the asymptotic claim).

## Recommendations (engineering, not thesis-blocking)

1. **Stage 3 tag construction**: replace the linear `class_token_streams` scan with a lookup in the existing `streams_by_name` hash map. Drops the worst-case from `O(E²)` to `O(E)`. Cost: a few lines in `pattern_hook_dispatcher.cpp`.
2. **Stage 2 double-tokenization**: cache the per-file token stream after the first tokenization so the class-extractor doesn't re-tokenize. Pure constant-factor improvement.
3. The empirical regression in `regression.md` will provide a quantitative check on whether the asymptotic claim holds for the input sizes actually exercised in the soak.
