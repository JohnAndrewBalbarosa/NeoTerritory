# Implementation Plan — Async Analysis + Tabs + Surveys

Combines two redesign threads into one build:
1. **Async pipeline** — microservice and AI commenter run in parallel; results-first UI.
2. **Tabbed studio + manual ambiguity review** — three fixed tabs with auto-advance.
3. **Survey flow** — consent gate, pre-test (Questionnaire A), per-run quality survey, sign-out survey.

Reference for question wording: `docs/Questionnaire/REFERENCE.md` (word-for-word, validated).

---

## 1. Async analysis pipeline (Option A — split endpoints)

### Backend

- **`POST /api/analyze`** — runs the C++ microservice synchronously, returns the structural analysis immediately. Also creates a *pending AI job* in memory keyed by a new `runId` (or `pendingId`). Response shape gains `aiStatus: 'pending' | 'disabled'` and `aiJobId: string | null`.
- **Background AI worker** — invoked from the analyze handler with `setImmediate(...)`; runs the existing `aiCommenterService` per detected pattern; writes results into an in-memory `aiJobs` map: `{ status: 'pending' | 'ready' | 'failed', annotations: AnnotationOut[], error?: string, expiresAt }`. TTL 10 min.
- **`GET /api/analyze/ai/:jobId`** — returns `{ status, annotations? }`. Frontend polls every 1.5 s until `status !== 'pending'`. (No SSE infra — keeps it simple.)
- **AI toggle** — `.env` flag `AI_COMMENTER_ENABLED=true|false`. When false, `/api/analyze` returns `aiStatus: 'disabled'` and frontend skips polling.

### Frontend

- Submit handler: POST → render structural annotations immediately, switch to Tab 2; if `aiJobId`, start polling. On AI ready, merge AI annotations into the store; SourceView reactively re-renders with the AI overlay (e.g. dotted left edge / different shade).
- Loading affordance: small "AI commentary loading…" pill in Tab 2 header that disappears on AI ready/fail.

### Files

- `Codebase/Backend/src/routes/analysis.ts` — split sync vs background, add jobs map, add `GET /ai/:jobId`.
- `Codebase/Backend/src/services/aiCommenterService.ts` — no API change, just called from background task.
- `Codebase/Frontend/src/store/analysisStore.ts` — add `aiStatus`, `aiAnnotations`, `mergeAiAnnotations()`.
- `Codebase/Frontend/src/api/client.ts` — add `pollAiJob(jobId)`.

---

## 2. Tabbed studio

Three fixed tabs across the top of the studio (after Privacy + Pre-Test gates clear).

| # | Tab | Contents | Auto-advance trigger |
|---|---|---|---|
| 1 | **Submit** | Code paste / file upload, run button, last-run summary card, *per-run quality survey modal* | — |
| 2 | **Annotated Source** | Existing `SourceView` + `LinePopover` + class-chip strip | Auto-jumps here when `/api/analyze` returns (structural ready). AI overlay merges in later without a tab switch. |
| 3 | **Ambiguous Review** | List of grey lines (≥2 detected patterns) with per-line manual decision UI | Optional badge with count; user navigates manually. |

Tab 3 detail:
- Each row shows the line excerpt, all candidate `patternKey`s with their colors, and a radio: `(o) <PatternA>  ( ) <PatternB>  ( ) None of the above  ( ) Other: ____`.
- Submit button per row OR bulk save. On save, posts to `POST /api/analysis/:runId/manual-review` → updates that line's annotation: drops the ambiguity, sets `patternKey` to the chosen one, persists in DB. Tab 2 reflects vivid color on next render.
- If no ambiguous lines exist, Tab 3 shows empty state ("No ambiguous lines in this run").

### Files

- `Codebase/Frontend/src/components/layout/MainLayout.tsx` — replace right-rail with tab bar + tab content area.
- `Codebase/Frontend/src/components/tabs/SubmitTab.tsx` — new.
- `Codebase/Frontend/src/components/tabs/AnnotatedTab.tsx` — wraps existing `SourceView`.
- `Codebase/Frontend/src/components/tabs/AmbiguousTab.tsx` — new.
- `Codebase/Backend/src/routes/analysis.ts` — add `POST /:runId/manual-review` (auth required, validates run ownership).
- `Codebase/Backend/src/db/initDb.ts` — add `manual_pattern_decisions` table (idempotent migration).

---

## 3. Survey flow

All wording pulled verbatim from `docs/Questionnaire/REFERENCE.md`. Star ratings render as a 5-star control (`StarRating` component, keyboard + screen-reader accessible).

### 3a. Consent gate

- Modal/page after `POST /auth/claim` succeeds, before main UI loads.
- Single checkbox + Continue button. Decline → redirects back to seat picker; backend releases the seat.
- On accept → `POST /api/survey/consent` `{ acceptedAt, version: '2026-05-01' }`. Persisted in `survey_consent`.

### 3b. Pre-test (Questionnaire A)

- Shown only on **first session** for that user (devcon testers must complete; production users skipped — A is research-only).
- Renders the Section A profile questions verbatim. Backend POSTs to `/api/survey/pretest` → `survey_pretest`.
- ⚠️ Source `.docx.md` only has Section A (Profile) — A's title block is missing. Block wired but copy stays in `REFERENCE.md` placeholder until paste arrives.

### 3c. Per-run quality survey

- Trigger: tester clicks "Run analysis" again **after** at least one completed run.
- Modal blocks Tab 1; cannot dismiss. Star ratings for B.3–B.7 + 2 open-ended (B.G.3, B.G.4).
- Submit → `POST /api/survey/run/:runId` → `run_feedback`. Then the new run is dispatched.

### 3d. Sign-out survey

- Trigger: clicking "Sign out". Cannot be skipped (devcon).
- Star ratings for the remaining items in B (overall), C, D, E, F + open-ended B.G.1, B.G.2, B.G.5.
- Submit → `POST /api/survey/session` → `session_feedback`. Then proceeds with logout.

### Files

- `Codebase/Frontend/src/components/survey/ConsentGate.tsx`
- `Codebase/Frontend/src/components/survey/PretestForm.tsx`
- `Codebase/Frontend/src/components/survey/RunSurveyModal.tsx`
- `Codebase/Frontend/src/components/survey/SignoutSurvey.tsx`
- `Codebase/Frontend/src/components/survey/StarRating.tsx` (shared)
- `Codebase/Frontend/src/data/surveyQuestions.ts` — exports the verbatim arrays imported from REFERENCE.md (one source). Each item has `{ id: 'B.3', text: '...', kind: 'star' | 'open' }`.
- `Codebase/Backend/src/routes/survey.ts` — new: `POST /consent`, `POST /pretest`, `POST /run/:runId`, `POST /session`. All auth-gated, Zod-validated.
- `Codebase/Backend/src/db/initDb.ts` — add tables:
  - `survey_consent (user_id, accepted_at, version)`
  - `survey_pretest (user_id, answers_json, submitted_at)`
  - `run_feedback (run_id, user_id, ratings_json, open_json, submitted_at)`
  - `session_feedback (user_id, session_uuid, ratings_json, open_json, submitted_at)`
- `Codebase/Backend/src/validation/schemas.ts` — Zod schemas for each survey payload; star rating values constrained to 1..5.

---

## Implementation order

1. **DB migrations** for all four survey tables + `manual_pattern_decisions` (single PR's worth, idempotent, safe to run twice).
2. **Backend split analyze + AI poll endpoint** (testable via curl before any frontend work).
3. **Backend survey + manual-review routes** (testable via curl).
4. **Frontend `surveyQuestions.ts`** seeded from REFERENCE.md; **StarRating** component.
5. **Frontend tabs scaffold** (replaces right-rail; existing SourceView moves into Tab 2 unchanged).
6. **Frontend AmbiguousTab** + manual review wire-up.
7. **Frontend ConsentGate + PretestForm** (gates the studio entry).
8. **Frontend RunSurveyModal** (gates re-runs).
9. **Frontend SignoutSurvey** (gates logout).
10. **AI async polling** wire-up + loading pill.

Each step type-checks and runs end-to-end before the next is started.

---

## Open questions for the user

- **Q1:** OK to skip Questionnaire A from going live until you paste the validated A wording into `REFERENCE.md`? (Stub is wired but unrendered until ready.)
- **Q2:** Per-run survey — appears **before** the new run dispatches (must answer to re-run), or appears in a side toast that doesn't block? Plan above assumes blocking.
- **Q3:** Sign-out survey for **production** users (the admin / non-devcon path) — also collected, or devcon-only? Plan above assumes devcon-only required, prod gets a Skip link.
