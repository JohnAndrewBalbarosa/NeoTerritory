# AWS DB vs Fixture — Stats Parity Check

_Generated 2026-05-16T00:12:01.291Z — pulled rows live from 122.248.192.49._

- DB `run_feedback` rows: **150** (expected 150)
- DB `session_feedback` rows: **30** (expected 30)
- DB `survey_consent` rows: **31** (expected 30)
- DB `analysis_runs` rows: **151** (expected 150)

## Per-question parity

| Scope | Item | DB N | DB Mean | DB SD | Fixture N | Fixture Mean | Match |
|---|---|---:|---:|---:|---:|---:|---|
| per-run | **B.3** | 150 | 4.25 | 0.73 | 150 | 4.25 | ✓ |
| per-run | **B.4** | 150 | 4.23 | 0.72 | 150 | 4.23 | ✓ |
| per-run | **B.5** | 150 | 4.25 | 0.73 | 150 | 4.25 | ✓ |
| per-run | **B.6** | 150 | 4.23 | 0.72 | 150 | 4.23 | ✓ |
| per-run | **B.7** | 150 | 4.14 | 0.70 | 150 | 4.14 | ✓ |
| sign-out | **B.1** | 30 | 4.10 | 0.84 | 30 | 4.10 | ✓ |
| sign-out | **B.2** | 30 | 4.27 | 0.74 | 30 | 4.27 | ✓ |
| sign-out | **B.8** | 30 | 4.17 | 0.70 | 30 | 4.17 | ✓ |
| sign-out | **C.9** | 30 | 4.30 | 0.70 | 30 | 4.30 | ✓ |
| sign-out | **C.10** | 30 | 4.17 | 0.75 | 30 | 4.17 | ✓ |
| sign-out | **C.11** | 30 | 4.23 | 0.63 | 30 | 4.23 | ✓ |
| sign-out | **C.12** | 30 | 4.20 | 0.71 | 30 | 4.20 | ✓ |
| sign-out | **C.13** | 30 | 4.13 | 0.68 | 30 | 4.13 | ✓ |
| sign-out | **D.14** | 30 | 4.40 | 0.56 | 30 | 4.40 | ✓ |
| sign-out | **D.15** | 30 | 4.13 | 0.63 | 30 | 4.13 | ✓ |
| sign-out | **E.16** | 30 | 4.03 | 0.56 | 30 | 4.03 | ✓ |
| sign-out | **E.17** | 30 | 4.47 | 0.57 | 30 | 4.47 | ✓ |
| sign-out | **F.18** | 30 | 4.07 | 0.87 | 30 | 4.07 | ✓ |
| sign-out | **F.19** | 30 | 4.43 | 0.57 | 30 | 4.43 | ✓ |
| profile | **A.1** | 30 | 2.60 | 0.97 | 30 | 2.60 | ✓ |
| profile | **A.2** | 30 | 1.87 | 0.68 | 30 | 1.87 | ✓ |
| profile | **A.3** | 30 | 2.67 | 0.80 | 30 | 2.67 | ✓ |
| profile | **A.4** | 30 | 2.87 | 0.73 | 30 | 2.87 | ✓ |
| profile | **A.5** | 30 | 1.93 | 0.74 | 30 | 1.93 | ✓ |

**Total mismatches: 0**

## Per-section weighted means recomputed from DB

| Section | Total obs | Sum | Weighted mean |
|---|---:|---:|---:|
| **Functional Suitability** | 840 | 3542 | 4.22 |
| **Usability** | 150 | 631 | 4.21 |
| **Performance Efficiency** | 60 | 256 | 4.27 |
| **Reliability** | 60 | 255 | 4.25 |
| **Security and Data Protection** | 60 | 255 | 4.25 |
