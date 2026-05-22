# NeoTerritory Analyzer — Time & Space Complexity

**Legend**: n = input token count · m = AST nodes (= O(n)) · p = catalog patterns (~10, constant) · s = symbols collected · k = competing matches per site · f = findings emitted

## Table 1. Per-stage time complexity

| Pipeline stage | Best case | Average case | Worst case | Notes |
|---|---|---|---|---|
| Lexical analysis (tokenization) | O(n) | O(n) | O(n) | Single linear scan over source bytes. |
| Main tree / AST construction | O(n) | O(n) | O(n) | One pass over the token stream. |
| ReverseMerkle hashing | O(m) | O(m) | O(m) | Each node hashed exactly once. |
| Symbol table build | O(n) | O(n) | O(n) | Hash-map inserts; amortized O(1) per symbol. |
| Symbol resolution / lookup | O(1) | O(1) | O(s) | Worst case = degenerate hash collision chain. |
| Pattern matching (catalog × nodes) | O(n) | O(n·p) | O(n·p) | p bounded by catalog → effectively O(n). |
| Pattern ranking (lexeme → structure tiebreak) | O(1) | O(k) | O(k log k) | k = competing matches at one site (typically <5). |
| Subtree comparison (diffing) | O(1) | O(m) | O(m) | Best: root hashes match → early exit. |
| Output JSON generation | O(f) | O(f) | O(f) | f bounded by O(n). |
| **End-to-end pipeline** | **O(n)** | **O(n)** | **O(n)** | Empirical: wall ≈ 9.51·n + 1002 µs, R² = 0.9932 (n = 150). |

## Table 2. Per-stage space complexity

| Pipeline stage | Best case | Average case | Worst case | Notes |
|---|---|---|---|---|
| Lexical analysis (tokenization) | O(n) | O(n) | O(n) | Token vector retained for downstream stages. |
| Main tree / AST construction | O(n) | O(n) | O(n) | One AST node per construct. |
| ReverseMerkle hashing | O(m) | O(m) | O(m) | One hash stored per node. |
| Symbol table build | O(s) | O(s) | O(s) | s ≤ n. |
| Symbol resolution / lookup | O(1) | O(1) | O(1) | Read-only against existing table. |
| Pattern matching | O(1) | O(f) | O(n) | f findings emitted. |
| Pattern ranking | O(1) | O(k) | O(k) | Scratch buffer per site. |
| Subtree comparison (diffing) | O(1) | O(log m) | O(m) | Recursion stack; worst = unbalanced subtree. |
| Output JSON generation | O(f) | O(f) | O(n) | Serialized analysis_json payload. |
| **End-to-end pipeline** | **O(n)** | **O(n)** | **O(n)** | Empirical: bytes ≈ 0.15·n + 910, R² = 0.6154 (n = 150). |

> Empirical calibration: AWS Lightsail production sweep, 7 sizes × 5 repeats = 35 microservice samples, re-measured across 150 cohort runs. Slope = algorithmic cost per token; intercept = environment-dependent setup, not part of the algorithm.
