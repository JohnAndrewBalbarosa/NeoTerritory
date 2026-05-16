# Cronbach's Alpha — Internal-Consistency Reliability

_Generated 2026-05-16T00:30:33.524Z from `tools/thesis-sim/dataset.json` (N = 30 respondents, 19 Likert items)._

Per-respondent rolling rule for Section B per-run items (B.3 — B.7): the five ratings collected across the respondent's five analysis runs are averaged into one score per item per respondent before being fed into the alpha formula. Section B.1 / B.2 / B.8 and Sections C-F are session-only items used as-is.

## Per-subscale results

| Subscale | Items | k | N | α | Interpretation | Inter-item r (k=2 only) |
|---|---|---:|---:|---:|---|---:|
| **Functional Suitability (Section B)** | B.1, B.2, B.3, B.4, B.5, B.6, B.7, B.8 | 8 | 30 | 0.8854 | Good | — |
| **Usability (Section C)** | C.9, C.10, C.11, C.12, C.13 | 5 | 30 | 0.8477 | Good | — |
| **Performance Efficiency (Section D)** | D.14, D.15 | 2 | 30 | 0.9106 | Excellent | 0.8362 |
| **Reliability (Section E)** | E.16, E.17 | 2 | 30 | 0.9479 | Excellent | 0.9010 |
| **Security & Data Protection (Section F)** | F.18, F.19 | 2 | 30 | 0.9372 | Excellent | 0.8819 |

## Overall instrument

| Items | k | N | α | Interpretation |
|---|---:|---:|---:|---|
| All 19 Likert items (B.1 — F.19) | 19 | 30 | **0.9508** | **Excellent** |

## Threshold table (interpretation key)

| α range | Interpretation |
|---|---|
| α ≥ 0.90 | Excellent |
| 0.80 ≤ α < 0.90 | Good |
| 0.70 ≤ α < 0.80 | Acceptable |
| 0.60 ≤ α < 0.70 | Questionable |
| α < 0.60 | Poor (instrument needs revision) |

## Caveats

- Two-item subscales (Performance Efficiency, Reliability, Security & Data Protection) report Cronbach's α for completeness, but with k = 2 the value is mathematically equivalent to the Spearman-Brown prophecy of the inter-item correlation. The raw inter-item *r* is reported alongside α so the reader can judge the construct without being misled by k = 2 inflation/deflation effects.
- The 30 respondents are simulated (per-persona deterministic generation in `tools/thesis-sim/expand-dataset.mjs`). Persona-level coherence drives some between-item correlation, which is realistic for the kind of user voice the thesis is modelling but means the α value is a property of the simulated cohort, not a substitute for a live empirical reliability study with human respondents.