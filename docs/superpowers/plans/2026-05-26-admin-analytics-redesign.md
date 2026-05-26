# Admin Analytics + Accounts + UI Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture per-question theoretical-exam results, surface them in a new admin "Learning" heatmap tab with per-learner drilldown, add a provider (Google/guest/legacy) column to the Users tab, and restructure the admin shell into a grouped left sidebar with a visual polish pass.

**Architecture:** Backend SQLite gains a `learning_question_results` table and a `users.created_via` column (both idempotent, SQLite-only — no Supabase migration). The learner page POSTs per-question answers (signed-in only) to a new `PUT /api/learning/answers`. A new admin endpoint aggregates those rows (pure helper, unit-tested) for a per-family heatmap component. The admin shell moves from a flat top tab bar to a grouped left sidebar, preserving the `admin-tab-bar` testid and `originalDevsOnly`/PM filtering.

**Tech Stack:** TypeScript, Express + better-sqlite3 (backend), React + Vite (admin SPA), Vitest (unit tests, both sides), existing `admin.css` design tokens.

**Reference spec:** `docs/superpowers/specs/2026-05-26-admin-analytics-redesign-design.md`

---

## File Structure

**Backend**
- Modify `Codebase/Backend/src/db/initDb.ts` — add `learning_question_results` table; add `users.created_via` column + Devcon backfill.
- Create `Codebase/Backend/src/services/learningQuestionStats.ts` — pure helpers: `sanitizeAnswers`, `aggregateQuestionResults`. (Keeps SQL routes thin and the logic unit-testable.)
- Create `Codebase/Backend/src/__tests__/learningQuestionStats.test.ts` — unit tests for the helpers.
- Modify `Codebase/Backend/src/routes/learning.ts` — add `PUT /api/learning/answers`.
- Modify `Codebase/Backend/src/routes/admin.ts` — add `GET /api/admin/stats/learning-questions` (+ `?moduleId=&questionIndex=` drilldown); add `u.created_via` to the `/users` SELECT.
- Modify `Codebase/Backend/src/routes/googleAuth.ts` — write `created_via='oauth'` on OAuth user insert.

**Frontend**
- Modify `Codebase/Frontend/src/api/client.ts` — `saveLearningAnswers`, `fetchAdminLearningQuestions`, `fetchAdminLearningQuestionDetail`.
- Modify `Codebase/Frontend/src/types/api.ts` — `AdminUser.created_via`; analytics row types.
- Modify `Codebase/Frontend/src/components/marketing/patterns/PatternsLearnPage.tsx` — POST per-question answers on theoretical submit (signed-in only).
- Create `Codebase/Frontend/src/admin/logic/passRateBucket.ts` — pure bucket helper.
- Create `Codebase/Frontend/src/admin/logic/__tests__/passRateBucket.test.ts` — unit test.
- Create `Codebase/Frontend/src/admin/components/LearningAnalytics.tsx` — heatmap tab + drilldown.
- Modify `Codebase/Frontend/src/admin/components/UserTable.tsx` — Provider column + filter.
- Modify `Codebase/Frontend/src/admin/AdminApp.tsx` — sidebar restructure, register Learning tab.
- Modify `Codebase/Frontend/admin.css` — sidebar nav styles, heatmap styles, polish pass.

**Docs**
- Modify `docs/Codebase/DESIGN_DECISIONS.md` — add D87.

---

## Task 0: Record design decision D87 (do first)

**Files:**
- Modify: `docs/Codebase/DESIGN_DECISIONS.md` (append after D86)

- [ ] **Step 1: Append D87**

Append this block to the end of `docs/Codebase/DESIGN_DECISIONS.md`:

```markdown
## D87 — Admin per-question analytics + provider column + sidebar shell

**Per-question capture.** Theoretical-exam results are recorded per
(user, module, question) in a SQLite-only table `learning_question_results`
(user_id, module_id, question_index, selected_index, is_correct,
first_attempt_correct, attempts, updated_at). Signed-in learners only —
guests on `devcon*` seats never POST. Forward-only (no historical backfill).
`first_attempt_correct` is locked on the first recorded row and never
overwritten; subsequent submits update selected_index/is_correct and bump
attempts. The headline analytics metric is FIRST-ATTEMPT correct rate, because
passing an exam requires every answer correct so eventual correctness is
trivially ~100%.

**Admin Learning tab.** `GET /api/admin/stats/learning-questions` aggregates the
table into per-(family,module,question) rows; the tab renders a per-family
heatmap (modules × questions, cell colour = first-try pass rate) with a
per-learner drilldown via `?moduleId=&questionIndex=`. Question/option text is
resolved client-side from LEARNING_MODULES, not stored server-side.

**Accounts provider.** SQLite `users` gains `created_via` ('oauth'|'guest'|
'legacy', default 'legacy'); the Google path writes 'oauth', a one-time backfill
marks `Devcon%` rows 'guest'. The Users tab gets a Provider column + filter.

**Admin shell.** The flat top `.admin-tab-bar` becomes a left sidebar grouped by
section (Operations / People / Learning / Research / Config). The
`data-testid="admin-tab-bar"` anchor is preserved on the new nav so the routes
manifest + CI smoke stay green. `originalDevsOnly` + PM filtering unchanged.

Both schema changes are SQLite-only (initDb), so no Supabase migration.
```

- [ ] **Step 2: Commit**

```bash
git add docs/Codebase/DESIGN_DECISIONS.md
git commit -m "docs(design): D87 admin per-question analytics + provider + sidebar"
```

---

## Task 1: Backend — `learning_question_results` table + `users.created_via`

**Files:**
- Modify: `Codebase/Backend/src/db/initDb.ts` (learning_progress block ~lines 215-236; users column block ~lines 44-62)

- [ ] **Step 1: Add the results table after the `theory_passed_module_ids` ALTER**

In `initDb.ts`, immediately after the `theory_passed_module_ids` ALTER try/catch (the block added in D86), insert:

```typescript
  // ── learning_question_results (per-question theoretical-exam results) ────
  // One row per (user, module, question). first_attempt_correct is locked on
  // the first recorded row; is_correct/selected_index/attempts reflect the
  // latest submit. Signed-in learners only — the client guards guests. SQLite
  // only; no Supabase mirror (D87).
  db.prepare(`CREATE TABLE IF NOT EXISTS learning_question_results (
    user_id INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    selected_index INTEGER NOT NULL,
    is_correct INTEGER NOT NULL,
    first_attempt_correct INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, module_id, question_index),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`).run();
```

- [ ] **Step 2: Add the `created_via` column + backfill near the users-table setup**

Find the users-table migration area (the `ALTER TABLE users ADD COLUMN last_active` region near lines 44-62). Add after the existing user ALTERs:

```typescript
  // created_via: how the account was created — 'oauth' (Google), 'guest'
  // (Devcon seat), or 'legacy' (username/password incl. seeded admin).
  // SQLite-only (the Supabase migration for this column does not reach the
  // admin's SQLite data). Idempotent via the duplicate-column catch (D87).
  try {
    db.prepare(`ALTER TABLE users ADD COLUMN created_via TEXT NOT NULL DEFAULT 'legacy'`).run();
    // One-time backfill: existing Devcon* seats are guests. Safe to run every
    // boot — only flips rows still on the 'legacy' default.
    db.prepare(`UPDATE users SET created_via = 'guest'
                WHERE username LIKE 'Devcon%' AND created_via = 'legacy'`).run();
  } catch {
    /* column already exists — nothing to do */
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd Codebase/Backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add Codebase/Backend/src/db/initDb.ts
git commit -m "feat(db): learning_question_results table + users.created_via column"
```

---

## Task 2: Backend — pure helpers `sanitizeAnswers` + `aggregateQuestionResults` (TDD)

**Files:**
- Create: `Codebase/Backend/src/services/learningQuestionStats.ts`
- Test: `Codebase/Backend/src/__tests__/learningQuestionStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `Codebase/Backend/src/__tests__/learningQuestionStats.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeAnswers, aggregateQuestionResults } from '../services/learningQuestionStats';

describe('sanitizeAnswers', () => {
  it('keeps valid rows and coerces correctness to 0/1', () => {
    const out = sanitizeAnswers([
      { questionIndex: 0, selectedIndex: 2, isCorrect: true },
      { questionIndex: 1, selectedIndex: 0, isCorrect: false },
    ]);
    expect(out).toEqual([
      { questionIndex: 0, selectedIndex: 2, isCorrect: 1 },
      { questionIndex: 1, selectedIndex: 0, isCorrect: 0 },
    ]);
  });

  it('drops non-objects, negatives, and over-cap entries', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ questionIndex: i, selectedIndex: 0, isCorrect: true }));
    const out = sanitizeAnswers([{ questionIndex: -1, selectedIndex: 0, isCorrect: true }, 'x' as unknown, ...many]);
    expect(out.length).toBe(50); // MAX_ANSWERS cap, negative + junk dropped
    expect(out.every((a) => a.questionIndex >= 0)).toBe(true);
  });

  it('returns [] for non-array input', () => {
    expect(sanitizeAnswers(undefined)).toEqual([]);
    expect(sanitizeAnswers({} as unknown)).toEqual([]);
  });
});

describe('aggregateQuestionResults', () => {
  it('rolls raw rows into per-question first-try pass rate + option distribution', () => {
    const rows = [
      { module_id: 'foundations-what-is-pattern', question_index: 0, selected_index: 1, first_attempt_correct: 1 },
      { module_id: 'foundations-what-is-pattern', question_index: 0, selected_index: 0, first_attempt_correct: 0 },
      { module_id: 'foundations-what-is-pattern', question_index: 1, selected_index: 2, first_attempt_correct: 1 },
    ];
    const out = aggregateQuestionResults(rows);
    const q0 = out.find((r) => r.moduleId === 'foundations-what-is-pattern' && r.questionIndex === 0)!;
    expect(q0.seen).toBe(2);
    expect(q0.firstTryCorrect).toBe(1);
    expect(q0.passRate).toBeCloseTo(0.5);
    expect(q0.optionDistribution[0]).toBe(1);
    expect(q0.optionDistribution[1]).toBe(1);
    expect(q0.family).toBe('foundations');
  });

  it('derives family from the module-id prefix', () => {
    const out = aggregateQuestionResults([
      { module_id: 'creational-singleton', question_index: 0, selected_index: 0, first_attempt_correct: 1 },
    ]);
    expect(out[0].family).toBe('creational');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Codebase/Backend && npx vitest run src/__tests__/learningQuestionStats.test.ts`
Expected: FAIL — `Cannot find module '../services/learningQuestionStats'`.

- [ ] **Step 3: Implement the helpers**

Create `Codebase/Backend/src/services/learningQuestionStats.ts`:

```typescript
// Pure helpers for per-question theoretical-exam analytics (D87). Kept out of
// the route handlers so they can be unit-tested without a DB or HTTP harness.

const MAX_ANSWERS = 50;
const MAX_INDEX = 10_000;

export interface CleanAnswer {
  questionIndex: number;
  selectedIndex: number;
  isCorrect: 0 | 1;
}

// Normalise the PUT /api/learning/answers body.answers array: objects only,
// non-negative bounded ints, correctness coerced to 0/1, capped at MAX_ANSWERS.
export function sanitizeAnswers(input: unknown): CleanAnswer[] {
  if (!Array.isArray(input)) return [];
  const out: CleanAnswer[] = [];
  for (const raw of input) {
    if (out.length >= MAX_ANSWERS) break;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const qi = Number(r.questionIndex);
    const si = Number(r.selectedIndex);
    if (!Number.isInteger(qi) || qi < 0 || qi > MAX_INDEX) continue;
    if (!Number.isInteger(si) || si < 0 || si > MAX_INDEX) continue;
    out.push({ questionIndex: qi, selectedIndex: si, isCorrect: r.isCorrect ? 1 : 0 });
  }
  return out;
}

export interface RawResultRow {
  module_id: string;
  question_index: number;
  selected_index: number;
  first_attempt_correct: number;
}

export interface QuestionStat {
  family: string;
  moduleId: string;
  questionIndex: number;
  seen: number;
  firstTryCorrect: number;
  passRate: number; // firstTryCorrect / seen, 0 when seen === 0
  optionDistribution: number[]; // counts per selected_index (latest answers)
}

// Family is the module-id prefix before the first hyphen (matches the
// LearningCategory ids: foundations / creational / structural / behavioural /
// idioms). Mirrors how module ids are built in learningModules.ts.
function familyOf(moduleId: string): string {
  const dash = moduleId.indexOf('-');
  return dash > 0 ? moduleId.slice(0, dash) : moduleId;
}

export function aggregateQuestionResults(rows: ReadonlyArray<RawResultRow>): QuestionStat[] {
  const byKey = new Map<string, QuestionStat>();
  for (const row of rows) {
    const key = `${row.module_id}#${row.question_index}`;
    let stat = byKey.get(key);
    if (!stat) {
      stat = {
        family: familyOf(row.module_id),
        moduleId: row.module_id,
        questionIndex: row.question_index,
        seen: 0,
        firstTryCorrect: 0,
        passRate: 0,
        optionDistribution: [],
      };
      byKey.set(key, stat);
    }
    stat.seen += 1;
    if (row.first_attempt_correct) stat.firstTryCorrect += 1;
    const opt = row.selected_index;
    while (stat.optionDistribution.length <= opt) stat.optionDistribution.push(0);
    stat.optionDistribution[opt] += 1;
  }
  for (const stat of byKey.values()) {
    stat.passRate = stat.seen > 0 ? stat.firstTryCorrect / stat.seen : 0;
  }
  return Array.from(byKey.values());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Codebase/Backend && npx vitest run src/__tests__/learningQuestionStats.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add Codebase/Backend/src/services/learningQuestionStats.ts Codebase/Backend/src/__tests__/learningQuestionStats.test.ts
git commit -m "feat(learning): pure helpers for per-question answer sanitize + aggregate"
```

---

## Task 3: Backend — `PUT /api/learning/answers`

**Files:**
- Modify: `Codebase/Backend/src/routes/learning.ts` (add route before `export default router;`)

- [ ] **Step 1: Import the sanitizer**

At the top of `learning.ts`, add to the imports:

```typescript
import { sanitizeAnswers } from '../services/learningQuestionStats';
```

- [ ] **Step 2: Add the route before `export default router;`**

```typescript
// Per-question theoretical-exam results (D87). Called by the learner page on
// each exam submit for signed-in learners (the client guards guests). Upserts
// one row per (user, module, question); first_attempt_correct is locked on the
// first row and never overwritten. Best-effort from the client's view.
router.put('/answers', jwtAuth, (req: Request, res: Response, next: NextFunction): void => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = (req.body ?? {}) as { moduleId?: unknown; attempt?: unknown; answers?: unknown };
    const moduleId =
      typeof body.moduleId === 'string' && body.moduleId.length > 0 && body.moduleId.length <= MAX_ID_LEN
        ? body.moduleId
        : null;
    if (!moduleId) {
      res.status(400).json({ error: 'moduleId required' });
      return;
    }
    const attempt = Number.isInteger(body.attempt) && (body.attempt as number) > 0 ? (body.attempt as number) : 1;
    const answers = sanitizeAnswers(body.answers);

    const upsert = db.prepare(
      `INSERT INTO learning_question_results
         (user_id, module_id, question_index, selected_index, is_correct, first_attempt_correct, attempts, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, module_id, question_index) DO UPDATE SET
         selected_index = excluded.selected_index,
         is_correct     = excluded.is_correct,
         attempts       = excluded.attempts,
         updated_at     = datetime('now')`,
    );
    const tx = db.transaction((rows: typeof answers) => {
      for (const a of rows) {
        // On first insert first_attempt_correct = this submit's correctness;
        // the ON CONFLICT branch deliberately omits it so it is never updated.
        upsert.run(req.user!.id, moduleId, a.questionIndex, a.selectedIndex, a.isCorrect, a.isCorrect, attempt);
      }
    });
    tx(answers);

    res.json({ ok: true, recorded: answers.length });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Typecheck**

Run: `cd Codebase/Backend && npx tsc --noEmit`
Expected: no errors. (`MAX_ID_LEN` already exists in this file.)

- [ ] **Step 4: Commit**

```bash
git add Codebase/Backend/src/routes/learning.ts
git commit -m "feat(api): PUT /api/learning/answers records per-question exam results"
```

---

## Task 4: Frontend — POST answers from the theoretical exam (signed-in only)

**Files:**
- Modify: `Codebase/Frontend/src/api/client.ts` (after `saveLearningProgress`)
- Modify: `Codebase/Frontend/src/components/marketing/patterns/PatternsLearnPage.tsx`

- [ ] **Step 1: Add the client function**

In `client.ts`, after `saveLearningProgress`, add:

```typescript
export interface LearningAnswerInput {
  questionIndex: number;
  selectedIndex: number;
  isCorrect: boolean;
}

// D87: record per-question theoretical-exam results. Signed-in learners only —
// callers guard on canPersist. Best-effort; failure never blocks the exam.
export async function saveLearningAnswers(
  moduleId: string,
  attempt: number,
  answers: LearningAnswerInput[],
): Promise<void> {
  await apiFetch('/api/learning/answers', {
    method: 'PUT',
    body: JSON.stringify({ moduleId, attempt, answers }),
  });
}
```

- [ ] **Step 2: Pass a results callback into TheoreticalExamBlock**

In `PatternsLearnPage.tsx`, extend the `TheoreticalExamBlockProps` interface (currently `moduleId`, `exam`, `isPassed`, `onPass`) with:

```typescript
  onRecordAnswers?: (attempt: number, answers: { questionIndex: number; selectedIndex: number; isCorrect: boolean }[]) => void;
```

In `TheoreticalExamBlock`, inside `handleSubmit`, after `setSubmitted(true);` and before the `onPass` check, build and emit the per-question answer set:

```typescript
    const recorded = exam.questions.map((q, i) => ({
      questionIndex: i,
      selectedIndex: answers[i],
      isCorrect: answers[i] === q.correctIndex,
    }));
    onRecordAnswers?.(attempt, recorded);
```

- [ ] **Step 3: Wire the callback at the render site (signed-in only)**

In `PatternsLearnPage`, find the `<TheoreticalExamBlock ... />` render and add the prop. Use the existing `canPersist` flag (already computed in this component):

```tsx
              onRecordAnswers={(attempt, recorded) => {
                if (!canPersist) return;
                void saveLearningAnswers(activeModule.id, attempt, recorded).catch(() => {
                  /* best-effort; analytics is forward-only */
                });
              }}
```

Add `saveLearningAnswers` to the existing import from `../../../api/client`.

- [ ] **Step 4: Typecheck + build**

Run: `cd Codebase/Frontend && npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Codebase/Frontend/src/api/client.ts Codebase/Frontend/src/components/marketing/patterns/PatternsLearnPage.tsx
git commit -m "feat(learn): POST per-question exam results for signed-in learners"
```

---

## Task 5: Backend — admin aggregation endpoints

**Files:**
- Modify: `Codebase/Backend/src/routes/admin.ts` (add after the `/users` route)

- [ ] **Step 1: Import the aggregator**

At the top of `admin.ts`, add:

```typescript
import { aggregateQuestionResults, type RawResultRow } from '../services/learningQuestionStats';
```

- [ ] **Step 2: Add the matrix + drilldown endpoint**

After the `/users` route handler, add:

```typescript
// Per-question learning analytics (D87). Without query params: the aggregate
// matrix (one row per module+question). With ?moduleId=&questionIndex=: the
// per-learner drilldown for one question.
router.get('/stats/learning-questions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const moduleId = typeof req.query.moduleId === 'string' ? req.query.moduleId : '';
    const qiRaw = typeof req.query.questionIndex === 'string' ? Number(req.query.questionIndex) : NaN;

    if (moduleId && Number.isInteger(qiRaw)) {
      // Drilldown: who answered this question and how.
      const learners = db.prepare(`
        SELECT u.id AS userId, u.username, u.email,
               q.selected_index AS selectedIndex,
               q.is_correct AS isCorrect,
               q.first_attempt_correct AS firstAttemptCorrect,
               q.attempts AS attempts
        FROM learning_question_results q
        JOIN users u ON u.id = q.user_id
        WHERE q.module_id = ? AND q.question_index = ?
        ORDER BY u.username ASC
      `).all(moduleId, qiRaw);
      res.json({ learners });
      return;
    }

    const rows = db.prepare(`
      SELECT module_id, question_index, selected_index, first_attempt_correct
      FROM learning_question_results
    `).all() as RawResultRow[];
    res.json({ questions: aggregateQuestionResults(rows) });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Add `created_via` to the `/users` SELECT**

In the existing `/users` route, change the SELECT to include `u.created_via`:

```typescript
    const rows = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_active, u.created_via,
             COUNT(r.id) AS runCount,
             MAX(r.created_at) AS lastRunAt
      FROM users u
      LEFT JOIN analysis_runs r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY runCount DESC, u.username ASC
    `).all();
```

- [ ] **Step 4: Typecheck**

Run: `cd Codebase/Backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add Codebase/Backend/src/routes/admin.ts
git commit -m "feat(api): admin learning-questions matrix + drilldown; users.created_via"
```

---

## Task 6: Backend — write `created_via='oauth'` on Google signup

**Files:**
- Modify: `Codebase/Backend/src/routes/googleAuth.ts` (the `INSERT INTO users` at ~line 270)

- [ ] **Step 1: Update the OAuth insert**

Change the insert from:

```typescript
    `INSERT INTO users (username, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(username, safeEmail, placeholderHash, localRole);
```

to:

```typescript
    `INSERT INTO users (username, email, password_hash, role, created_at, created_via)
     VALUES (?, ?, ?, ?, datetime('now'), 'oauth')`
  ).run(username, safeEmail, placeholderHash, localRole);
```

- [ ] **Step 2: Typecheck**

Run: `cd Codebase/Backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add Codebase/Backend/src/routes/googleAuth.ts
git commit -m "feat(auth): tag Google-created accounts created_via=oauth"
```

---

## Task 7: Frontend — types for provider + analytics

**Files:**
- Modify: `Codebase/Frontend/src/types/api.ts`

- [ ] **Step 1: Add `created_via` to `AdminUser`**

Find `export interface AdminUser` and add:

```typescript
  created_via?: 'oauth' | 'guest' | 'legacy';
```

- [ ] **Step 2: Add analytics row types**

Add to `types/api.ts`:

```typescript
export interface AdminLearningQuestionStat {
  family: string;
  moduleId: string;
  questionIndex: number;
  seen: number;
  firstTryCorrect: number;
  passRate: number;
  optionDistribution: number[];
}

export interface AdminLearningQuestionLearner {
  userId: number;
  username: string;
  email?: string | null;
  selectedIndex: number;
  isCorrect: number;
  firstAttemptCorrect: number;
  attempts: number;
}
```

- [ ] **Step 3: Add client fetchers in `client.ts`**

```typescript
export async function fetchAdminLearningQuestions(): Promise<{ questions: import('../types/api').AdminLearningQuestionStat[] }> {
  return apiFetch('/api/admin/stats/learning-questions');
}

export async function fetchAdminLearningQuestionDetail(
  moduleId: string,
  questionIndex: number,
): Promise<{ learners: import('../types/api').AdminLearningQuestionLearner[] }> {
  const qs = `moduleId=${encodeURIComponent(moduleId)}&questionIndex=${questionIndex}`;
  return apiFetch(`/api/admin/stats/learning-questions?${qs}`);
}
```

- [ ] **Step 4: Typecheck + commit**

Run: `cd Codebase/Frontend && npm run typecheck`
Expected: no errors.

```bash
git add Codebase/Frontend/src/types/api.ts Codebase/Frontend/src/api/client.ts
git commit -m "feat(admin): types + client for provider column and learning analytics"
```

---

## Task 8: Frontend — `passRateBucket` pure helper (TDD)

**Files:**
- Create: `Codebase/Frontend/src/admin/logic/passRateBucket.ts`
- Test: `Codebase/Frontend/src/admin/logic/__tests__/passRateBucket.test.ts`

- [ ] **Step 1: Write the failing test**

Create `Codebase/Frontend/src/admin/logic/__tests__/passRateBucket.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { passRateBucket } from '../passRateBucket';

describe('passRateBucket', () => {
  it('returns none when there is no data', () => {
    expect(passRateBucket(0, 0)).toBe('none');
  });
  it('buckets high/mid/low by first-try pass rate', () => {
    expect(passRateBucket(0.9, 10)).toBe('high');
    expect(passRateBucket(0.8, 10)).toBe('high');
    expect(passRateBucket(0.65, 10)).toBe('mid');
    expect(passRateBucket(0.5, 10)).toBe('mid');
    expect(passRateBucket(0.49, 10)).toBe('low');
    expect(passRateBucket(0, 4)).toBe('low');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Codebase/Frontend && npx vitest run src/admin/logic/__tests__/passRateBucket.test.ts`
Expected: FAIL — cannot find module `../passRateBucket`.

- [ ] **Step 3: Implement**

Create `Codebase/Frontend/src/admin/logic/passRateBucket.ts`:

```typescript
export type PassBucket = 'high' | 'mid' | 'low' | 'none';

// Heatmap cell bucket from first-try pass rate. `seen` 0 means no learner has
// answered this question yet → 'none' (grey cell), distinct from a 0% pass.
export function passRateBucket(passRate: number, seen: number): PassBucket {
  if (seen <= 0) return 'none';
  if (passRate >= 0.8) return 'high';
  if (passRate >= 0.5) return 'mid';
  return 'low';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd Codebase/Frontend && npx vitest run src/admin/logic/__tests__/passRateBucket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Codebase/Frontend/src/admin/logic/passRateBucket.ts Codebase/Frontend/src/admin/logic/__tests__/passRateBucket.test.ts
git commit -m "feat(admin): passRateBucket helper for heatmap cells"
```

---

## Task 9: Frontend — `LearningAnalytics` heatmap tab + drilldown

**Files:**
- Create: `Codebase/Frontend/src/admin/components/LearningAnalytics.tsx`

- [ ] **Step 1: Create the component**

Create `Codebase/Frontend/src/admin/components/LearningAnalytics.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import {
  fetchAdminLearningQuestions,
  fetchAdminLearningQuestionDetail,
} from '../../api/client';
import type {
  AdminLearningQuestionStat,
  AdminLearningQuestionLearner,
} from '../../types/api';
import {
  CATEGORY_META,
  findLearningModule,
  modulesInCategory,
  type LearningCategory,
} from '../../data/learningModules';
import { passRateBucket } from '../logic/passRateBucket';

// Map a moduleId+questionIndex to its question text from the catalog (the
// single source of truth — text is not stored server-side, D87).
function questionText(moduleId: string, qi: number): string {
  const mod = findLearningModule(moduleId);
  const q = mod?.theoreticalExam?.questions[qi];
  return q ? q.question : `Q${qi + 1}`;
}
function optionLabel(moduleId: string, qi: number, oi: number): string {
  const mod = findLearningModule(moduleId);
  const opt = mod?.theoreticalExam?.questions[qi]?.options[oi];
  return opt ?? `Option ${oi + 1}`;
}

export default function LearningAnalytics(): JSX.Element {
  const [stats, setStats] = useState<AdminLearningQuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<LearningCategory>('foundations');
  const [drill, setDrill] = useState<{ moduleId: string; qi: number } | null>(null);
  const [learners, setLearners] = useState<AdminLearningQuestionLearner[] | null>(null);

  useEffect(() => {
    fetchAdminLearningQuestions()
      .then((d) => setStats(d.questions ?? []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!drill) { setLearners(null); return; }
    let cancelled = false;
    fetchAdminLearningQuestionDetail(drill.moduleId, drill.qi)
      .then((d) => { if (!cancelled) setLearners(d.learners ?? []); })
      .catch(() => { if (!cancelled) setLearners([]); });
    return () => { cancelled = true; };
  }, [drill]);

  // Index stats by module+question for O(1) cell lookup.
  const statByKey = useMemo(() => {
    const m = new Map<string, AdminLearningQuestionStat>();
    for (const s of stats) m.set(`${s.moduleId}#${s.questionIndex}`, s);
    return m;
  }, [stats]);

  const modules = modulesInCategory(family).filter((mod) => Boolean(mod.theoreticalExam));
  const maxQ = modules.reduce((n, mod) => Math.max(n, mod.theoreticalExam?.questions.length ?? 0), 0);
  const hasAnyData = stats.length > 0;

  if (loading) return <div className="empty-state">Loading learning analytics…</div>;

  return (
    <div className="admin-learn-analytics">
      <nav className="admin-learn-families" aria-label="Pattern family">
        {CATEGORY_META.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`admin-learn-family-btn${family === c.id ? ' is-active' : ''}`}
            onClick={() => { setFamily(c.id); setDrill(null); }}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {!hasAnyData ? (
        <div className="empty-state">
          No exam data yet. Per-question results are recorded as signed-in learners
          take the theoretical exams (analytics is forward-only).
        </div>
      ) : (
        <div className="admin-heatmap" role="table" aria-label={`${family} score heatmap`}>
          <div className="admin-heatmap__row admin-heatmap__row--head" role="row">
            <span className="admin-heatmap__corner" role="columnheader">Module ↓ / Question →</span>
            {Array.from({ length: maxQ }, (_, qi) => (
              <span key={qi} className="admin-heatmap__col" role="columnheader">Q{qi + 1}</span>
            ))}
          </div>
          {modules.map((mod) => {
            const qCount = mod.theoreticalExam?.questions.length ?? 0;
            return (
              <div key={mod.id} className="admin-heatmap__row" role="row">
                <span className="admin-heatmap__rowhead" role="rowheader" title={mod.title}>{mod.title}</span>
                {Array.from({ length: maxQ }, (_, qi) => {
                  if (qi >= qCount) {
                    return <span key={qi} className="admin-heatmap__cell" data-bucket="none" aria-hidden="true" />;
                  }
                  const stat = statByKey.get(`${mod.id}#${qi}`);
                  const seen = stat?.seen ?? 0;
                  const rate = stat?.passRate ?? 0;
                  const bucket = passRateBucket(rate, seen);
                  const pct = seen > 0 ? Math.round(rate * 100) : null;
                  return (
                    <button
                      key={qi}
                      type="button"
                      className="admin-heatmap__cell"
                      data-bucket={bucket}
                      title={`${mod.title} · Q${qi + 1}\n${questionText(mod.id, qi)}\n${seen} learners · ${pct === null ? 'no data' : pct + '% first-try'}`}
                      onClick={() => seen > 0 && setDrill({ moduleId: mod.id, qi })}
                      disabled={seen === 0}
                    >
                      {pct === null ? '·' : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {drill && (
        <div className="admin-section admin-section--card" style={{ marginTop: 16 }}>
          <header className="admin-section__head">
            <h2>{findLearningModule(drill.moduleId)?.title} · Q{drill.qi + 1}</h2>
            <p className="admin-section__hint">{questionText(drill.moduleId, drill.qi)}</p>
          </header>
          {learners === null ? (
            <div className="empty-state">Loading learners…</div>
          ) : learners.length === 0 ? (
            <div className="empty-state">No learners have answered this question yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Learner</th><th>Selected</th><th>First try</th><th>Attempts</th></tr>
              </thead>
              <tbody className="runs-disabled">
                {learners.map((l) => (
                  <tr key={l.userId}>
                    <td><strong>{l.username}</strong>{l.email && <><br /><small>{l.email}</small></>}</td>
                    <td>{optionLabel(drill.moduleId, drill.qi, l.selectedIndex)}</td>
                    <td>{l.firstAttemptCorrect ? '✓' : '✗'}</td>
                    <td>{l.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setDrill(null)}>
            Close drilldown
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd Codebase/Frontend && npm run typecheck`
Expected: no errors. (`findLearningModule`, `modulesInCategory`, `CATEGORY_META`, `LearningCategory` are all exported from `data/learningModules.ts`; `theoreticalExam.questions` exists per D86.)

- [ ] **Step 3: Commit**

```bash
git add Codebase/Frontend/src/admin/components/LearningAnalytics.tsx
git commit -m "feat(admin): Learning analytics heatmap tab + per-learner drilldown"
```

---

## Task 10: Frontend — Provider column + filter in UserTable

**Files:**
- Modify: `Codebase/Frontend/src/admin/components/UserTable.tsx`

- [ ] **Step 1: Add a provider filter type + cycle (near the SortKey/PresenceFilter block, ~lines 11-29)**

```typescript
type ProviderFilter = 'all' | 'oauth' | 'guest' | 'legacy';
const PROVIDER_CYCLE: ProviderFilter[] = ['all', 'oauth', 'guest', 'legacy'];
const PROVIDER_LABELS: Record<ProviderFilter, string> = {
  all: 'Provider: all',
  oauth: 'Google',
  guest: 'Guest',
  legacy: 'Legacy',
};
const PROVIDER_PILL: Record<string, string> = { oauth: 'Google', guest: 'Guest', legacy: 'Legacy' };
```

- [ ] **Step 2: Add provider state + cycle handler (near the other `useState`/cycle fns, ~lines 47-101)**

```typescript
  const [provider, setProvider] = useState<ProviderFilter>('all');
  function cycleProvider() {
    setProvider(p => PROVIDER_CYCLE[(PROVIDER_CYCLE.indexOf(p) + 1) % PROVIDER_CYCLE.length]);
  }
```

- [ ] **Step 3: Apply the provider filter (in the filtering block, ~lines 142-147)**

After the presence filter lines and before `const visible = applySort(...)`, add:

```typescript
  if (provider !== 'all') filtered = filtered.filter(u => (u.created_via ?? 'legacy') === provider);
```

- [ ] **Step 4: Add the filter control button (in `.user-search-bar`, next to the presence button ~line 211)**

```tsx
        <button
          className={`user-ctrl-btn${provider !== 'all' ? ' is-active' : ''}`}
          onClick={cycleProvider}
          title="Cycle provider filter (All / Google / Guest / Legacy)"
        >
          {PROVIDER_LABELS[provider]}
        </button>
```

- [ ] **Step 5: Add the Provider column header (in `<thead>`, after the Role `<th>` ~line 268)**

```tsx
                <th>Provider</th>
```

- [ ] **Step 6: Add the Provider cell (in the row body, after the Role `<td>` ~line 300) and fix the empty-row colSpan**

Add after the role `<td>`:

```tsx
                    <td>
                      <span className="provider-pill" data-provider={u.created_via ?? 'legacy'}>
                        {PROVIDER_PILL[u.created_via ?? 'legacy'] ?? 'Legacy'}
                      </span>
                    </td>
```

Change the no-match empty row `colSpan={6}` to `colSpan={7}` (a column was added).

- [ ] **Step 7: Typecheck + commit**

Run: `cd Codebase/Frontend && npm run typecheck`
Expected: no errors.

```bash
git add Codebase/Frontend/src/admin/components/UserTable.tsx
git commit -m "feat(admin): provider column + filter in Users tab"
```

---

## Task 11: Frontend — register Learning tab + sidebar restructure

**Files:**
- Modify: `Codebase/Frontend/src/admin/AdminApp.tsx`

- [ ] **Step 1: Import the new tab + a Learning icon**

Add to imports:

```typescript
import LearningAnalytics from './components/LearningAnalytics';
```

Add `IconBookOpen` (or reuse `IconLayers`) to the icon import line. If `IconBookOpen` does not exist in `../components/icons/Icons`, reuse `IconClipboard` for the Learning tab to avoid inventing an icon.

- [ ] **Step 2: Extend the tab id union + TabDef with a section**

Change the `AdminTab` type to add `'learning'`:

```typescript
type AdminTab = 'runs' | 'complexity' | 'users' | 'reviews' | 'ai' | 'logs' | 'catalogs' | 'invites' | 'joinRequests' | 'featureReleases' | 'learning';

type AdminSection = 'Operations' | 'People' | 'Learning' | 'Research' | 'Config';

interface TabDef {
  id: AdminTab;
  label: string;
  icon: ComponentType<IconProps>;
  section: AdminSection;
  originalDevsOnly?: boolean;
}
```

- [ ] **Step 3: Rewrite the TABS array with sections**

```typescript
const TABS: ReadonlyArray<TabDef> = [
  { id: 'runs',            label: 'Runs',            icon: IconLayers,      section: 'Operations' },
  { id: 'logs',            label: 'Logs',            icon: IconClipboard,   section: 'Operations' },
  { id: 'users',           label: 'Users',           icon: IconShield,      section: 'People' },
  { id: 'invites',         label: 'Invites',         icon: IconCheckSquare, section: 'People' },
  { id: 'joinRequests',    label: 'Join requests',   icon: IconShield,      section: 'People' },
  { id: 'learning',        label: 'Learning',        icon: IconClipboard,   section: 'Learning' },
  { id: 'complexity',      label: 'Complexity',      icon: IconBeaker,      section: 'Research', originalDevsOnly: true },
  { id: 'reviews',         label: 'Reviews',         icon: IconCheckSquare, section: 'Research', originalDevsOnly: true },
  { id: 'featureReleases', label: 'Feature releases',icon: IconCode,        section: 'Research', originalDevsOnly: true },
  { id: 'ai',              label: 'AI',              icon: IconCode,        section: 'Config' },
  { id: 'catalogs',        label: 'Pattern groups',  icon: IconBeaker,      section: 'Config' },
];

const SECTION_ORDER: AdminSection[] = ['Operations', 'People', 'Learning', 'Research', 'Config'];
```

- [ ] **Step 4: Replace the `<nav className="admin-tab-bar">` block with a grouped sidebar**

Replace the entire existing `<nav className="admin-tab-bar" ...>…</nav>` (lines ~317-341) with:

```tsx
      <div className="admin-body">
        <nav className="admin-tab-bar admin-sidebar" aria-label="Admin sections" data-testid="admin-tab-bar">
          {SECTION_ORDER.map((section) => {
            const tabs = TABS.filter((t) => {
              if (t.section !== section) return false;
              if (t.originalDevsOnly && isPmAdmin(user)) return false;
              if (t.originalDevsOnly && !isOriginalDevsAdmin(user)) return false;
              return true;
            });
            if (tabs.length === 0) return null;
            return (
              <div className="admin-sidebar__group" key={section}>
                <p className="admin-sidebar__label">{section}</p>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`admin-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <span className="admin-tab-btn__icon" aria-hidden="true"><Icon size={15} /></span>
                      <span className="admin-tab-btn__label">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
```

NOTE: this opens an `admin-body` flex wrapper and the sidebar. The existing `<main className="admin-main" key={refreshKey}>` that follows now becomes the second child of `admin-body`. You must add a closing `</div>` for `admin-body` after the `</main>` closing tag (before the final `</div>` of `admin-shell`).

- [ ] **Step 5: Add the Learning tab panel inside `<main>`**

Inside `<main className="admin-main">`, add alongside the other `<div hidden=…>` panels:

```tsx
        <div hidden={activeTab !== 'learning'}>
          <section className="admin-section admin-section--card">
            <header className="admin-section__head">
              <h2>Learning scores</h2>
              <p className="admin-section__hint">First-attempt pass rate per question, grouped by family → module. Click a cell for the per-learner breakdown.</p>
            </header>
            <LearningAnalytics />
          </section>
        </div>
```

- [ ] **Step 6: Close the `admin-body` wrapper**

After `</main>` (the admin-main close), add `</div>` to close `admin-body`. Verify the JSX nests as: `admin-shell > (topbar) + admin-body > (admin-sidebar nav + admin-main)`.

- [ ] **Step 7: Typecheck + build**

Run: `cd Codebase/Frontend && npm run build`
Expected: `tsc --noEmit` passes, `vite build` succeeds.

- [ ] **Step 8: Commit**

```bash
git add Codebase/Frontend/src/admin/AdminApp.tsx
git commit -m "feat(admin): grouped left sidebar shell + Learning tab registration"
```

---

## Task 12: CSS — sidebar nav, heatmap, provider pill, polish

**Files:**
- Modify: `Codebase/Frontend/admin.css`

- [ ] **Step 1: Add the body/sidebar layout (replace the old top-tab-bar flex rules)**

Find `.admin-tab-bar{display:flex;border-bottom:…}` (~line 285) and replace that single rule with:

```css
/* Grouped left-sidebar shell (D87). admin-body is the flex row: sidebar + main. */
.admin-body{display:flex;gap:20px;align-items:flex-start;}
.admin-sidebar{display:flex;flex-direction:column;gap:14px;flex:0 0 210px;border-bottom:none;padding:8px 4px 8px 0;position:sticky;top:12px;}
.admin-sidebar__group{display:flex;flex-direction:column;gap:3px;}
.admin-sidebar__label{margin:0 0 2px;font-family:var(--code-font);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim);padding:0 10px;}
.admin-main{flex:1 1 auto;min-width:0;}
@media (max-width: 820px){
  .admin-body{flex-direction:column;}
  .admin-sidebar{flex-direction:row;flex-wrap:wrap;flex-basis:auto;position:static;border-bottom:1px solid var(--border);padding-bottom:10px;}
}
```

- [ ] **Step 2: Re-style the tab button for the sidebar (replace the `.admin-tab-btn` rules ~lines 286-294)**

```css
.admin-tab-btn{display:flex;align-items:center;gap:10px;width:100%;font-family:var(--ui-font);font-weight:600;font-size:13px;padding:9px 12px;border:1px solid transparent;border-radius:var(--radius-md);background:transparent;cursor:pointer;color:var(--ink-soft);transition:color 160ms,background 160ms,border-color 160ms;letter-spacing:.01em;text-align:left;}
.admin-tab-btn:hover{color:var(--ink);background:var(--surface);}
.admin-tab-btn.is-active{color:var(--ink);background:var(--surface2);border-color:var(--border-bright);box-shadow:inset 3px 0 0 var(--accent);}
.admin-tab-btn__icon{display:inline-flex;align-items:center;color:currentColor;opacity:.85;}
.admin-tab-btn__label{font-weight:600;}
```

(The `.admin-tab-btn__index`, `.is-active::after` glow, and `@keyframes nt-tab-glow` rules from the old bar can be deleted — the index span is no longer rendered.)

- [ ] **Step 3: Add heatmap + family-tab styles**

Append to `admin.css`:

```css
/* Learning analytics heatmap (D87) */
.admin-learn-families{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;}
.admin-learn-family-btn{padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--ink-soft);font:inherit;font-size:12px;cursor:pointer;transition:color 160ms,background 160ms,border-color 160ms;}
.admin-learn-family-btn:hover{color:var(--ink);border-color:var(--border-bright);}
.admin-learn-family-btn.is-active{color:var(--ink);background:var(--accent-glow);border-color:var(--accent);}
.admin-heatmap{display:flex;flex-direction:column;gap:4px;overflow-x:auto;}
.admin-heatmap__row{display:grid;grid-template-columns:200px repeat(var(--qcols, 6), minmax(46px, 1fr));gap:4px;align-items:center;}
.admin-heatmap__row--head .admin-heatmap__col,.admin-heatmap__corner{font-family:var(--code-font);font-size:10px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.06em;text-align:center;}
.admin-heatmap__corner{text-align:left;}
.admin-heatmap__rowhead{font-size:12px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;}
.admin-heatmap__cell{height:30px;border:none;border-radius:var(--radius-sm);font-family:var(--code-font);font-size:10px;font-weight:600;color:#0b0c10;cursor:pointer;transition:transform 120ms;}
.admin-heatmap__cell:hover:not(:disabled){transform:scale(1.06);}
.admin-heatmap__cell:disabled{cursor:default;}
.admin-heatmap__cell[data-bucket="high"]{background:var(--green);}
.admin-heatmap__cell[data-bucket="mid"]{background:var(--amber);}
.admin-heatmap__cell[data-bucket="low"]{background:var(--red);}
.admin-heatmap__cell[data-bucket="none"]{background:var(--surface2);color:var(--ink-dim);cursor:default;}
```

NOTE: set the column count by adding `style={{ ['--qcols' as string]: maxQ }}` to the `.admin-heatmap` div in `LearningAnalytics.tsx` (update Task 9's heatmap div), OR hardcode `repeat(8, …)`. Prefer the CSS variable — add the inline style in the component.

- [ ] **Step 4: Add the provider pill**

```css
/* Provider pill in the Users table (D87) */
.provider-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid var(--border-bright);}
.provider-pill[data-provider="oauth"]{color:var(--cyan);border-color:color-mix(in oklab, var(--cyan) 45%, transparent);background:color-mix(in oklab, var(--cyan) 12%, transparent);}
.provider-pill[data-provider="guest"]{color:var(--amber);border-color:color-mix(in oklab, var(--amber) 45%, transparent);background:color-mix(in oklab, var(--amber) 12%, transparent);}
.provider-pill[data-provider="legacy"]{color:var(--ink-soft);}
```

- [ ] **Step 5: Polish pass — looser tables + section rhythm**

Update these existing rules for more breathing room:

```css
.admin-table th,.admin-table td{padding:12px 14px;border-bottom:1px solid var(--border);}
.admin-section{margin-bottom:28px;}
.admin-section--card{padding:24px 26px;}
.admin-section h2{font-size:19px;margin:0 0 6px;}
```

- [ ] **Step 6: Wire the `--qcols` style in the component**

In `LearningAnalytics.tsx`, change the heatmap container div to:

```tsx
        <div className="admin-heatmap" role="table" aria-label={`${family} score heatmap`} style={{ ['--qcols' as never]: maxQ }}>
```

- [ ] **Step 7: Build + theme-leak check**

Run: `cd Codebase/Frontend && npm run build && npm run check:theme`
Expected: build succeeds; theme check passes.

- [ ] **Step 8: Commit**

```bash
git add Codebase/Frontend/admin.css Codebase/Frontend/src/admin/components/LearningAnalytics.tsx
git commit -m "style(admin): sidebar nav, heatmap, provider pill, density polish"
```

---

## Task 13: Verify, CI sync, and full rebuild

**Files:** none (verification + final checks)

- [ ] **Step 1: Run all unit tests**

Run: `cd Codebase/Backend && npx vitest run` then `cd Codebase/Frontend && npm run test:unit`
Expected: all pass (incl. the new `learningQuestionStats` and `passRateBucket` suites).

- [ ] **Step 2: Confirm CI surfaces don't need changes**

- The `data-testid="admin-tab-bar"` anchor is preserved on the new sidebar nav (Task 11 Step 4). Confirm `tests/routes.manifest.json` row for `/admin` still resolves — no change expected.
- Grep `scripts/ci-aws-post-deploy-smoke.mjs` for `learning` / `created_via` / `admin/users` shape assertions: `grep -niE "learning|created_via|admin/users|stats/" scripts/ci-aws-post-deploy-smoke.mjs`. Expected: no assertion on the new shapes; if any, update it in this commit.

- [ ] **Step 3: Full rebuild (Backend + Frontend changed)**

Run: `./scripts/rebuild.sh`
Expected: micro+docker rebuild; read the printed sha-diff lines to confirm layers rebuilt. Container healthy on `:3001`, `/api/health` OK.

- [ ] **Step 4: Manual smoke**

- Sign in to `/admin`: sidebar shows grouped sections; Learning tab present; Users tab shows a Provider column + a Provider filter button that cycles All/Google/Guest/Legacy.
- As a signed-in (non-guest) learner, pass a theoretical exam at `/patterns/learn`; then in admin Learning tab, the relevant family's heatmap shows a coloured cell; click it → per-learner drilldown lists your account, selected option, ✓/✗, attempts.
- Empty state: a family with no answered questions shows the "No exam data yet" message, not a broken grid.

- [ ] **Step 5: Push**

```bash
git push
```

---

## Self-Review (completed during authoring)

- **Spec coverage:** Unit 1 capture → Tasks 1-4; Unit 2 analytics → Tasks 5,7,8,9 (+CSS T12); Unit 3 provider → Tasks 1,5,6,7,10 (+CSS T12); Unit 4 shell+polish → Tasks 11,12. DESIGN_DECISIONS D87 → Task 0. CI/rebuild → Task 13. All spec sections mapped.
- **Placeholder scan:** no TBD/TODO; every code step shows real code; the only conditional is the `IconBookOpen`-or-reuse note (Task 11 Step 1), resolved by reusing `IconClipboard`.
- **Type/name consistency:** `created_via` union `'oauth'|'guest'|'legacy'` consistent across initDb default, googleAuth write, `AdminUser`, UserTable, CSS `data-provider`. `AdminLearningQuestionStat`/`AdminLearningQuestionLearner` field names match between the admin route JSON, the client fetchers, and `LearningAnalytics.tsx`. `aggregateQuestionResults`/`RawResultRow`/`sanitizeAnswers` names match between the service, its test, and the routes. `passRateBucket(passRate, seen)` signature matches its test and call site.
```
