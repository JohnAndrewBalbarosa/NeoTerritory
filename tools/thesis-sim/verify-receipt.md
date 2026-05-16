# AWS DB vs Fixture — Stats Parity Check

_Generated 2026-05-16T03:21:20.450Z — pulled rows live from 122.248.192.49._

- DB `run_feedback` rows: **250** (expected 250)
- DB `session_feedback` rows: **50** (expected 50)
- DB `survey_consent` rows: **50** (expected 50)
- DB `analysis_runs` rows: **250** (expected 250)

## Per-question parity

| Scope | Item | DB N | DB Mean | DB SD | Fixture N | Fixture Mean | Match |
|---|---|---:|---:|---:|---:|---:|---|
| per-run | **B.3** | 250 | 4.22 | 0.73 | 250 | 4.22 | ✓ |
| per-run | **B.4** | 250 | 4.22 | 0.71 | 250 | 4.22 | ✓ |
| per-run | **B.5** | 250 | 4.23 | 0.76 | 250 | 4.23 | ✓ |
| per-run | **B.6** | 250 | 4.20 | 0.73 | 250 | 4.20 | ✓ |
| per-run | **B.7** | 250 | 4.19 | 0.71 | 250 | 4.19 | ✓ |
| sign-out | **B.1** | 50 | 4.10 | 0.81 | 50 | 4.10 | ✓ |
| sign-out | **B.2** | 50 | 4.00 | 0.93 | 50 | 4.00 | ✓ |
| sign-out | **B.8** | 50 | 4.06 | 0.96 | 50 | 4.06 | ✓ |
| sign-out | **C.9** | 50 | 4.06 | 0.91 | 50 | 4.06 | ✓ |
| sign-out | **C.10** | 50 | 4.20 | 0.76 | 50 | 4.20 | ✓ |
| sign-out | **C.11** | 50 | 4.14 | 0.78 | 50 | 4.14 | ✓ |
| sign-out | **C.12** | 50 | 4.20 | 0.93 | 50 | 4.20 | ✓ |
| sign-out | **C.13** | 50 | 3.98 | 0.94 | 50 | 3.98 | ✓ |
| sign-out | **D.14** | 50 | 4.20 | 0.81 | 50 | 4.20 | ✓ |
| sign-out | **D.15** | 50 | 4.18 | 0.77 | 50 | 4.18 | ✓ |
| sign-out | **E.16** | 50 | 4.00 | 0.81 | 50 | 4.00 | ✓ |
| sign-out | **E.17** | 50 | 4.06 | 0.87 | 50 | 4.06 | ✓ |
| sign-out | **F.18** | 50 | 4.22 | 0.71 | 50 | 4.22 | ✓ |
| sign-out | **F.19** | 50 | 4.18 | 0.83 | 50 | 4.18 | ✓ |
| profile | **A.1** | 50 | 2.58 | 0.95 | 50 | 2.58 | ✓ |
| profile | **A.2** | 50 | 1.98 | 0.74 | 50 | 1.98 | ✓ |
| profile | **A.3** | 50 | 2.64 | 0.78 | 50 | 2.64 | ✓ |
| profile | **A.4** | 50 | 2.86 | 0.64 | 50 | 2.86 | ✓ |
| profile | **A.5** | 50 | 1.90 | 0.74 | 50 | 1.90 | ✓ |

**Total mismatches: 0**

## Per-section weighted means recomputed from DB

| Section | Total obs | Sum | Weighted mean |
|---|---:|---:|---:|
| **Functional Suitability** | 1400 | 5875 | 4.20 |
| **Usability** | 250 | 1029 | 4.12 |
| **Performance Efficiency** | 100 | 419 | 4.19 |
| **Reliability** | 100 | 403 | 4.03 |
| **Security and Data Protection** | 100 | 420 | 4.20 |
