# Resume Notes — 30-User Soak Pause #2

_Paused at 2026-05-16 08:54 (Manila). Pick up here next session._

## State at pause

Final AWS DB row counts:
- `run_feedback` = 113
- `session_feedback` = 20
- `manual_pattern_decisions` = 241
- `gdb.run.complete` logs = ~85+

Per-user shape:

| User | run_feedback | sessions | Action on resume |
|---|---:|---:|---|
| devcon1-19 | 5 each | 1 each | DONE |
| devcon20 | 4 | 0 | wipe + re-run |
| devcon21 | 4 | 0 | wipe + re-run |
| devcon22 | 5 | 0 | drop runs only? then re-run for session — or wipe + re-run |
| devcon23 | 4 | 0 | wipe + re-run |
| devcon24 | 1 | 0 | wipe + re-run |
| devcon25-28 | 0 | 0 | run from scratch |
| devcon29-30 | 0 | 0 | run from scratch (after rate-limit window opens) |

So 11 users still owe complete data: devcon20-30.

## Why it paused

The 20-user re-soak (devcon11-30 with the new tighter-coupling sessions)
hit the AWS auth rate limiter (`express-rate-limit` configured at 10
claims/15 min/IP at `Codebase/Backend/server.ts:95`). devcon11-19
completed cleanly, then claims for devcon20-30 returned `429 Too many
login attempts` until the window reset. After the window reset at ~08:47
a follow-up batch for devcon20-28 was launched (concurrency 4). It got
about 4 minutes in and was paused on user request before completing.

All `devcon%` seats were explicitly freed (`UPDATE users SET claimed_at
= NULL, last_active = NULL`) before exit, so the resume claim path is
clear.

## Resume strategy

**Important:** budget the auth rate limiter (10 claims / 15 min / IP).
The 11 missing users would normally need 11 claims, plus any retries.
Plan two batches separated by the rate-limiter window:

```bash
# 1. Wipe partials + free seats (no rate-limit cost — DB-only).
SSH="ssh -o StrictHostKeyChecking=accept-new -i $HOME/.ssh/lightsail_neoterritory ubuntu@122.248.192.49"
DB=/home/ubuntu/neoterritory/Codebase/Backend/dist/src/db/database.sqlite
USERS_TO_RESET="'devcon20','devcon21','devcon22','devcon23','devcon24','devcon25','devcon26','devcon27','devcon28','devcon29','devcon30'"
$SSH "sudo sqlite3 $DB <<SQL
BEGIN;
DELETE FROM run_feedback     WHERE user_id IN (SELECT id FROM users WHERE username IN ($USERS_TO_RESET));
DELETE FROM session_feedback WHERE user_id IN (SELECT id FROM users WHERE username IN ($USERS_TO_RESET));
DELETE FROM analysis_runs    WHERE user_id IN (SELECT id FROM users WHERE username IN ($USERS_TO_RESET));
DELETE FROM survey_consent   WHERE user_id IN (SELECT id FROM users WHERE username IN ($USERS_TO_RESET));
DELETE FROM manual_pattern_decisions WHERE user_id IN (SELECT id FROM users WHERE username IN ($USERS_TO_RESET));
UPDATE users SET claimed_at = NULL, last_active = NULL WHERE username LIKE 'devcon%';
COMMIT;
SQL"

# 2. Wait until the auth-rate-limit window has fresh capacity.
#    Easiest probe: a single curl /auth/test-accounts call returns 200
#    quickly when the limiter is healthy; the limiter applies to
#    /auth/login + /auth/claim only, NOT to /auth/test-accounts.
curl -fsS http://122.248.192.49/auth/test-accounts >/dev/null && echo "rate-limit window ready"

# 3. First batch: 9 users with concurrency 4 (uses 9 / 10 claims).
SOAK_USERNAMES=devcon20,devcon21,devcon22,devcon23,devcon24,devcon25,devcon26,devcon27,devcon28 \
SOAK_CONCURRENCY=4 \
nohup node scripts/simulate-tester-soak.mjs > test-artifacts/soak-runs/resume-batch1-stdout.log 2>&1 &

# 4. Wait for batch 1 to exit (PID printed above).
#    The new run-tests integration makes each cycle slower (~45-120 s
#    per call on the Lightsail GDB pod), so batch 1 takes ~12-18 min.
#    Use a Monitor: until ! tasklist //FI "PID eq <PID>" 2>/dev/null | grep -q node.exe; do sleep 15; done

# 5. Wait for the auth-rate-limit window to reset (~15 min after the
#    first claim of batch 1) before starting batch 2. A simple
#    sleep 900 between batches is enough; on resume just check the
#    timestamp of the last successful claim in the soak log.

# 6. Second batch: devcon29 + devcon30 (2 users, concurrency 2).
SOAK_USERNAMES=devcon29,devcon30 \
SOAK_CONCURRENCY=2 \
nohup node scripts/simulate-tester-soak.mjs > test-artifacts/soak-runs/resume-batch2-stdout.log 2>&1 &

# 7. After both batches complete:
node tools/thesis-sim/verify-aws-stats.mjs
# Expected: run_feedback=150, session_feedback=30, mismatches=0.
```

## Rate-limit context

The simulator's `authedHttp` recovery falls through to `/auth/login` on
401 → those count against the same 10 / 15 min limiter. If the AWS
backend is mid-cycle (recent pm2 restart), expect more 401s, more
recovery attempts, and faster rate-limit consumption. Mitigation: run
batches no larger than 8 users at a time, and pause 16 minutes between
batches if any 429s appear.

If the rate limit needs to be relaxed for the soak in particular,
either temporarily comment out the `app.use('/auth/login', authLimiter)`
+ `app.use('/auth/claim', authLimiter)` lines in
`Codebase/Backend/server.ts:133-134` and redeploy, or whitelist the
simulator's IP in the limiter config. Both options are out of scope for
this resume — only do them if the two-batch plan fails.

## What is already saved (committed before pause)

- `tools/thesis-sim/dataset.json` — 30 users with the new tighter
  per-respondent coupling (anchor + jitter, plus tight 2-item-pair
  coupling). devcon1-10 hand-authored unchanged; devcon11-30
  regenerated from `expand-dataset.mjs`.
- `tools/thesis-sim/reliability.md` — Cronbach's α per subscale +
  overall, computed from the 30-user fixture:
    Functional Suitability (k=8): α = 0.8854 (Good)
    Usability               (k=5): α = 0.8477 (Good)
    Performance Efficiency  (k=2): α = 0.9106 (Excellent), r = 0.8362
    Reliability             (k=2): α = 0.9479 (Excellent), r = 0.9010
    Security & Data Prot.   (k=2): α = 0.9372 (Excellent), r = 0.8819
    Overall instrument      (k=19): α = 0.9508 (Excellent)
- `tools/thesis-sim/regression.md` — 13-point sweep with normal-case
  cut (2500 ≤ N ≤ 14000): wall_ms R² = 0.9773, peak_kb R² = 0.9938.
  Full range R² = 0.9327 / 0.9961.
- `tools/thesis-sim/learner-module-practical-coverage.md` — proves
  every Foundations + pattern module has a practical attached. Factory
  Method specifically resolves to the pattern code-check via
  PATTERN_SLUG_ALIAS['factory-method'] → DETECTED_PATTERN_SLUGS['factory'].
- `FINAL THESIS 3 PAPER.docx` — Cronbach's Alpha methodology subsection
  inserted in Ch 3 Statistical Treatment block; Reliability Analysis
  Heading 2 inserted in Ch 4 with Table 27 (computed α values, k=2
  inter-item r values, interpretation paragraphs); Cronbach (1951) and
  George & Mallery (2003) bibliography entries inserted at their
  alphabetical slots. Pre-edit backup preserved at
  `FINAL THESIS 3 PAPER.backup-pre-cronbach-20260516-080808.docx`
  (gitignored).
- `Codebase/Microservice/samples/adapter/payment_gateway_adapter.cpp`
  and `Codebase/Microservice/samples/decorator/coffee_decorator.cpp`
  — two new C++ test samples extending analyzer coverage.

## Acceptance check on resume

When both batches finish:

1. `node tools/thesis-sim/verify-aws-stats.mjs` reports
   `run_feedback`=150, `session_feedback`=30, mismatches=0.
2. `curl -fsS -H "Authorization: Bearer <admin-jwt>" http://122.248.192.49/api/admin/stats/f1-metrics | jq .` returns
   `overall.tp >= 144` (the manual-review path produced TPs for every
   detected pattern across the cohort).
3. AWS DB shows `gdb.run.complete` logs ≥ 130 (one per analysis-run-
   tests cycle, allowing for a small dropout from rate-limit retries).
4. `git log --oneline -3` shows the resume + verify commit, both pushed.
