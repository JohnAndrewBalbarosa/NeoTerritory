# AWS DB Cleanup Receipt — 2026-05-15

Target: `/home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite` on `122.248.192.49`.

## Before

| Table | Rows |
|---|---:|
| `run_feedback` | 3 |
| `session_feedback` | 0 |
| `reviews` | 0 |
| `manual_pattern_decisions` | 6 |
| `analysis_runs` | 4 |
| `survey_pretest` | 0 |
| `survey_consent` | 84 |
| `jobs` | 0 |
| `logs` | 1200 |
| `users` | 108 |
| Devcon seats claimed | 0 |

## After

| Table | Rows |
|---|---:|
| `run_feedback` | 0 |
| `session_feedback` | 0 |
| `reviews` | 0 |
| `manual_pattern_decisions` | 0 |
| `analysis_runs` | 0 |
| `survey_pretest` | 0 |
| `survey_consent` | 0 |
| `jobs` | 0 |
| `logs` | 60 |
| `users` | 108 |
| Devcon seats claimed | 0 |

## What was preserved in `logs`

Login / auth audit events (`login`, `auth.google.login`, `auth.google.signup`) were intentionally kept — they are operator audit trail and not scoped to the deleted tester runs.

## What was wiped

- All four feedback / review tables (`run_feedback`, `session_feedback`, `reviews`, `manual_pattern_decisions`).
- All survey gates (`survey_pretest`, `survey_consent`).
- All run records (`analysis_runs`, `jobs`).
- Tester-scoped log events (`analysis`, `survey_*`, `frontend.run_*`, `frontend.gdb_test`, `gdb.*`, `claim_seat`, `manual_review`, `save`).
- `users.claimed_at` and `users.last_active` reset to `NULL` for `username LIKE 'devcon%'` so every seat is free for the next simulation.

`users` row count itself (108) is unchanged — the seeded admin + devcon1..100 + any organic accounts are all preserved.
