# Admin Analytics + Accounts + UI Restructure — Design Spec

**Date:** 2026-05-26
**Status:** Approved (design); pending implementation plan
**Surface:** Admin app (`admin.html` / `src/admin/**`), backend `learning` + `admin` routes, learning capture in `PatternsLearnPage`.

## Context

The admin dashboard has three gaps the user wants closed in one effort:

1. **Accounts are opaque about provider.** The Users tab shows username + email + role but gives no signal whether an account is a Google OAuth user, a shared guest seat, or a legacy admin. The runtime SQLite `users` table has no `created_via` column (the `created_via` migration that exists is Supabase/Postgres-only and does not reach the admin's SQLite data).
2. **No per-question learning analytics.** Per-question correctness is computed in the browser (`TheoreticalExamBlock`) and then discarded. Only per-*module* aggregates persist (`completed_module_ids`, `tries_by_module`, `theory_passed_module_ids`). There is no way to see how learners score on individual exam questions.
3. **The admin UI is cramped and plain.** Ten+ tabs sit in a flat top bar that wraps; spacing is tight, hierarchy is weak. There is dormant CSS (`.admin-learn-scopes`, `.admin-bands-editor`) from a never-built Learning tab.

This spec covers all three. They are independent enough to ship one at a time, but share the admin surface so they are designed together.

**Out of scope:** the broader whole-path pre/post parallel-form assessment system; proficiency-band editing; any change to the public learner-facing exam UX beyond a silent results POST.

## Approved decisions

- **Accounts:** add a Provider column + filter to the existing Users tab (not a separate Accounts view).
- **Analytics granularity:** aggregate per question **plus** a per-learner drilldown.
- **Whose data:** record per-question results for **signed-in learners only** (guests on `devcon*` seats skipped). Analytics is **forward-only** — no historical backfill.
- **Headline metric:** **first-attempt correct rate.** Eventual correctness is trivially ~100% because passing a theoretical exam requires every answer correct, so first-attempt is the honest difficulty signal. The drilldown additionally exposes each learner's selected option and attempt count.
- **Analytics layout:** **heatmap matrix per family** — family tabs at the top; modules as rows, `Q1..Qn` as columns; cell colour = first-attempt pass rate (green/amber/red, grey = no question); click a cell for the per-learner drilldown.
- **Admin shell:** **left sidebar grouped by section** replacing the flat top tab bar.
- **Redesign scope:** restructure **and** polish.

## Architecture

Four build units, in dependency order. Each is independently shippable.

### Unit 1 — Per-question capture (foundation)

**New SQLite table** (created idempotently in `Codebase/Backend/src/db/initDb.ts`, alongside `learning_progress`):

```sql
CREATE TABLE IF NOT EXISTS learning_question_results (
  user_id INTEGER NOT NULL,
  module_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  selected_index INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,            -- latest submitted answer correctness (0/1)
  first_attempt_correct INTEGER NOT NULL, -- set once, on the first recorded attempt
  attempts INTEGER NOT NULL DEFAULT 1,    -- exam attempts at the time of this record
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, module_id, question_index),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

Upsert rule on each submit: insert if new (set `first_attempt_correct` = this submit's correctness); on conflict, update `selected_index`, `is_correct`, bump `attempts`, refresh `updated_at`, and **never overwrite** `first_attempt_correct`.

**New endpoint** `PUT /api/learning/answers` (`Codebase/Backend/src/routes/learning.ts`, `jwtAuth`):
- Body: `{ moduleId: string, attempt: number, answers: Array<{ questionIndex: number; selectedIndex: number; isCorrect: boolean }> }`.
- Validation reuses the existing bounds (`MAX_ID_LEN`, payload cap); `questionIndex`/`selectedIndex` are non-negative ints, `answers` length-capped (e.g. ≤ 50).
- Guest detection: the route is jwtAuth-gated; the **frontend** guards on `canPersist` (non-guest) before calling, matching the existing progress logic. (Server trusts the token; guest seats simply never call it.)

**Frontend instrumentation** (`Codebase/Frontend/src/components/marketing/patterns/PatternsLearnPage.tsx`, `Codebase/Frontend/src/api/client.ts`):
- New client fn `saveLearningAnswers(moduleId, attempt, answers)`.
- `TheoreticalExamBlock.handleSubmit` builds the per-question answer array (it already computes correctness) and, via a callback to the page, calls `saveLearningAnswers` when `canPersist`. Fire-and-forget, never blocks the exam UX.

### Unit 2 — Learning analytics tab

**New admin aggregation endpoint** `GET /api/admin/stats/learning-questions` (`Codebase/Backend/src/routes/admin.ts`, `jwtAuth` + `requireAdmin`):
- Joins `learning_question_results` and returns rows shaped for the heatmap:
  ```ts
  {
    questions: Array<{
      family: LearningCategory; moduleId: string; questionIndex: number;
      seen: number; firstTryCorrect: number; passRate: number; // firstTryCorrect/seen
      optionDistribution: number[]; // counts per selected option (latest)
    }>
  }
  ```
- Question text / option labels are NOT stored server-side; the admin tab maps `moduleId` + `questionIndex` to text via the shared `LEARNING_MODULES` data (imported client-side) so the catalog stays the single source of truth.

**New client fn** `fetchAdminLearningQuestions()` in `api/client.ts`; types in `types/api.ts`.

**New tab component** `src/admin/components/LearningAnalytics.tsx`:
- Family tabs (Foundations / Creational / Structural / Behavioural / Idioms) from `CATEGORY_META`.
- Heatmap matrix: modules (rows) × question columns; cell colour bucketed on `passRate` (green ≥ ~0.8, amber ~0.5–0.8, red < 0.5, grey = no data/no question).
- Cell click → drilldown panel/drawer listing each learner's selected option, ✓/✗ (first-try), attempts. Drilldown data comes from an expanded endpoint variant (`?moduleId=&questionIndex=` returning per-user rows) so the matrix payload stays small.
- Activates the dormant `.admin-learn-*` CSS where it fits; adds heatmap cell styles.

Registered in `AdminApp.tsx` TABS under the **Learning** section.

### Unit 3 — Accounts provider column

- `initDb.ts`: idempotent `ALTER TABLE users ADD COLUMN created_via TEXT NOT NULL DEFAULT 'legacy'`. Backfill heuristic for existing rows (e.g. guest usernames `devcon*` → `'guest'`; rows created by the Google path → `'oauth'` where detectable; else `'legacy'`).
- Google OAuth insert path (`googleAuth.ts`) writes `created_via='oauth'`; guest-seat creation writes `'guest'`.
- `GET /api/admin/users` SELECT adds `u.created_via`; `AdminUser` type gains `created_via?: 'oauth'|'guest'|'legacy'`.
- `UserTable.tsx`: new **Provider** column rendering a pill (Google / Guest / Legacy) + a filter control above the table.

### Unit 4 — Admin shell restructure + polish

- `AdminApp.tsx`: replace the flat `.admin-tab-bar` row with a **left sidebar** grouped by section. Tab definitions gain a `section` field: Operations (Runs, Logs), People (Users, Invites, Join requests), Learning (new), Research (Complexity, Reviews, Feature releases — `originalDevsOnly`), Config (AI, Pattern groups). The `originalDevsOnly`/`isPmAdmin` filtering is preserved.
- Layout becomes sidebar + main content (grid). Active-state + glow affordances carried over.
- `admin.css` polish: increase panel padding and section-heading scale, consistent `.admin-section--card` chrome across tabs, calmer table density, more whitespace between groups. Reuse existing tokens (`--surface`, `--border`, `--accent`, radius/shadow vars).
- **Preserve `data-testid="admin-tab-bar"`** — keep it on the new sidebar nav so the routes manifest selector and the CI smoke continue to resolve. If it must move to a different element, update `tests/routes.manifest.json` in the same commit.

## Data flow

```
Learner submits theoretical exam (signed in)
  → TheoreticalExamBlock computes per-question correctness (already does)
  → PUT /api/learning/answers  → upsert learning_question_results
                                  (first_attempt_correct locked on first row)

Admin opens Learning tab
  → GET /api/admin/stats/learning-questions  → aggregate matrix
  → render family heatmap; cell click
  → GET /api/admin/stats/learning-questions?moduleId=&questionIndex=  → per-learner rows
```

## Error handling

- Answer POST is best-effort and fire-and-forget; a failure never blocks exam completion or module unlock (mirrors `saveLearningProgress`).
- Admin endpoints return `[]`/empty matrix when no data exists (forward-only means early state is empty — the tab must render an explicit "no exam data yet" empty state, not a broken grid).
- Aggregation tolerates `moduleId`s no longer in `LEARNING_MODULES` (stale ids) by skipping them, same posture as the progress route.

## Testing

- Backend: unit-test the `learning_question_results` upsert rule (first_attempt_correct immutability; attempts increment) and the aggregation SQL, following the existing `src/__tests__` vitest pattern (pure-function/helper level; no new HTTP harness).
- Frontend: the analytics tab's bucketing + empty-state are unit-testable; heatmap rendering verified manually + via the existing admin Playwright smoke if present.
- CI sync: confirm `admin-tab-bar` testid resolves post-restructure; verify `scripts/ci-aws-post-deploy-smoke.mjs` and `tests/routes.manifest.json` need no change (or update in the same commit if the testid host element changes).

## CI / docs obligations (per CLAUDE.md)

- `learning_question_results` and the `users.created_via` column are **SQLite-only** → no Supabase migration required; both added idempotently in `initDb.ts`.
- Add **DESIGN_DECISIONS D87** (per-question capture model + first-attempt metric + admin sidebar restructure + provider column) **before** writing dependent code.
- Routes manifest: only changes if the `admin-tab-bar` testid host moves.
- Per-prompt commit + push.

## Build order

1. Unit 1 (capture) — nothing visible yet, but starts accumulating data immediately.
2. Unit 2 (analytics tab) — consumes the captured data.
3. Unit 3 (provider column) — independent, small.
4. Unit 4 (shell restructure + polish) — wraps everything; do last so new tabs slot into the new nav.
