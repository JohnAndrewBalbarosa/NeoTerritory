# AWS DB vs Fixture — Stats Parity Check

_Generated 2026-05-15T15:19:45.353Z — pulled rows live from 122.248.192.49._

- DB `run_feedback` rows: **50** (expected 50)
- DB `session_feedback` rows: **10** (expected 10)
- DB `survey_consent` rows: **11** (expected 10)
- DB `analysis_runs` rows: **50** (expected 50)

## Per-question parity

| Scope | Item | DB N | DB Mean | DB SD | Fixture N | Fixture Mean | Match |
|---|---|---:|---:|---:|---:|---:|---|
| per-run | **B.3** | 50 | 4.22 | 0.71 | 50 | 4.22 | ✓ |
| per-run | **B.4** | 50 | 4.28 | 0.64 | 50 | 4.28 | ✓ |
| per-run | **B.5** | 50 | 4.20 | 0.64 | 50 | 4.20 | ✓ |
| per-run | **B.6** | 50 | 4.26 | 0.63 | 50 | 4.26 | ✓ |
| per-run | **B.7** | 50 | 4.04 | 0.67 | 50 | 4.04 | ✓ |
| sign-out | **B.1** | 10 | 4.30 | 0.67 | 10 | 4.30 | ✓ |
| sign-out | **B.2** | 10 | 4.20 | 0.63 | 10 | 4.20 | ✓ |
| sign-out | **B.8** | 10 | 4.10 | 0.74 | 10 | 4.10 | ✓ |
| sign-out | **C.9** | 10 | 4.40 | 0.52 | 10 | 4.40 | ✓ |
| sign-out | **C.10** | 10 | 4.00 | 0.67 | 10 | 4.00 | ✓ |
| sign-out | **C.11** | 10 | 4.40 | 0.52 | 10 | 4.40 | ✓ |
| sign-out | **C.12** | 10 | 4.20 | 0.63 | 10 | 4.20 | ✓ |
| sign-out | **C.13** | 10 | 4.00 | 0.67 | 10 | 4.00 | ✓ |
| sign-out | **D.14** | 10 | 4.20 | 0.42 | 10 | 4.20 | ✓ |
| sign-out | **D.15** | 10 | 4.00 | 0.67 | 10 | 4.00 | ✓ |
| sign-out | **E.16** | 10 | 3.80 | 0.42 | 10 | 3.80 | ✓ |
| sign-out | **E.17** | 10 | 4.30 | 0.48 | 10 | 4.30 | ✓ |
| sign-out | **F.18** | 10 | 4.40 | 0.52 | 10 | 4.40 | ✓ |
| sign-out | **F.19** | 10 | 4.30 | 0.48 | 10 | 4.30 | ✓ |
| profile | **A.1** | 10 | 2.40 | 1.07 | 10 | 2.40 | ✓ |
| profile | **A.2** | 10 | 1.90 | 0.74 | 10 | 1.90 | ✓ |
| profile | **A.3** | 10 | 2.50 | 0.71 | 10 | 2.50 | ✓ |
| profile | **A.4** | 10 | 2.80 | 0.79 | 10 | 2.80 | ✓ |
| profile | **A.5** | 10 | 1.90 | 0.74 | 10 | 1.90 | ✓ |

**Total mismatches: 0**

## Per-section weighted means recomputed from DB

| Section | Total obs | Sum | Weighted mean |
|---|---:|---:|---:|
| **Functional Suitability** | 280 | 1176 | 4.20 |
| **Usability** | 50 | 210 | 4.20 |
| **Performance Efficiency** | 20 | 82 | 4.10 |
| **Reliability** | 20 | 81 | 4.05 |
| **Security and Data Protection** | 20 | 87 | 4.35 |
