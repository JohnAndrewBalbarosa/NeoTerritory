# CodiNeo commercial AVP — audit and implementation blueprint

## Purpose and boundaries

Produce a repeatable, truthful product demonstration before building the under-two-minute commercial. Source footage must come from the actual product. This subsystem owns disposable demo state, verification, capture, and eventual video assembly. It does not own production authentication, learning scoring, recommendation rules, or C++ detection.

Read this audit first, then `Codebase/AVP/isolation.mjs`, `config.mjs`, `cli.mjs`, and `worker.ts`. `runtime.mjs` owns startup/shutdown, `frontend.mjs` configures the existing Vite host, and `preflight.mjs` verifies real authentication, authorization, analysis and browser rendering. The user's supplied commercial brief is the creative specification. Target the eventual final composition at 117 seconds; reserve at least 4 seconds for the closing brand lockup by shortening earlier segments.

## Repository audit

1. **Frontend:** React 18 components in `Codebase/Frontend/src`, Zustand state, Vite local/CI host. Production is Next.js 14 App Router in `Codebase/FrontendNext`, importing the same components. Its default API rewrite points at the live AWS backend. An AVP host must override this destination or use a dedicated Vite proxy.
2. **Backend:** Express/TypeScript in `Codebase/Backend/server.ts`; API-only. Main surfaces are `/auth`, `/api/admin`, `/api/learning`, `/api/project-learning`, `/api/analyze`, and saved runs. `FastifyService` is separate from this primary flow.
3. **Data:** `src/db/database.ts` opens SQLite using `DB_PATH`. `initDb.ts` supplies the schema and checked-in learning seed. Tables include users, learning modules/progress/attempts/answers, learning plans/modules, runs, settings and organization catalogs. Supabase supplies OAuth and optional remote mirrors; it is not the primary local runtime database.
4. **Authentication:** Google/Supabase exchange and local password login produce application JWTs. `jwtAuth.ts` verifies bearer JWTs and revocation; `requireAdmin.ts` enforces role `admin`. The commercial labels Project Manager and Intern correspond to the existing `admin` and `user` roles. Use real local password login for dedicated demo accounts; no production bypass is necessary.
5. **Project Manager:** `CoursePlanPanel.tsx` calls the real `/api/admin/course-plan` planner. Apply patches published module flags; this is shared course availability, not automatically an individual project assignment. Separate learning-plan and project-learning endpoints also exist. Verify their actual use in the capture rather than inventing a project-management screen.
6. **Recommendation:** `coursePlannerService.ts` uses a configured Gemini/Anthropic provider or its existing heuristic fallback. The exact supplied Community Project Prioritization specification was evaluated in a fresh demo database. With no local AI provider, it selected foundation modules only, not Strategy. Verification deliberately fails here. Do not force a Strategy result or modify scoring for this commercial.
7. **Learning:** Actual module ID `behavioural-strategy`, title `Strategy`, with content in `learningModules.ts` and the checked-in backend seed. It has six conceptual questions (including the Studio-type interaction) and a practical task targeting `strategyinterface` / Strategy Interface. The practical asks for a small C++ implementation recognized by the real analyzer. Do not put question-bank answer keys into footage or reports.
8. **Assessment/gates:** Formal pre/post forms, module scope, proficiency, completion and cycle rules live in the learning data/services and `LearningAssessmentPage.tsx`. Strategy must legitimately score below proficiency on the pre-test. Complete required module work and the required post-test before Studio, off-camera where appropriate. Never use `nt_learning_unlock_all` or fabricate assessment responses for AVP capture.
9. **Analyzer:** `classDeclarationAnalysisService.ts` invokes a local C++ executable with catalog/output/source arguments. An existing macOS binary lives at `Microservice/build-macos/NeoTerritory`, which is omitted by the backend's default resolver; the AVP process supplies `NEOTERRITORY_BIN`. No rebuild was performed. The existing binary's correspondence to the latest source is not established by its presence alone.
10. **Golden fixture:** Reuse `Microservice/samples/strategy/strategy_basic.cpp` verbatim. It already provides an abstract `Compressor`, `ZipCompressor`, `GzipCompressor`, and `Archiver` holding/swapping/delegating through the interface. The real binary detected the interface and two concrete classes with traceable source anchors and no diagnostics. Reusing this fixture means the code domain is compression, while the project-learning scenario remains community prioritization; explain or revise the creative transition honestly.
11. **Evidence:** Catalog `behavioural/strategy_interface.json` defines Strategy with concrete-role propagation and implementation/context signals. Verified output has interface/virtual/method and concrete/inheritance/base/override anchors. The verified interface method anchor points to the destructor in this fixture. It does not emit a separate context or delegation role. Show actual labels; context/delegation can be explained as source relationships in motion graphics, not claimed as analyzer-emitted roles.
    The real backend API additionally returned heuristic `classUsageBindings`: the held `Compressor`, `compressor->compress(payload)` delegation, concrete construction and `Archiver` call sites. These are useful source links, but their heuristic backend provenance must not be confused with C++ analyzer role labels. The API produced 11 documentation targets and 11 annotations.
12. **Documentation:** Analysis routes prepare documentation targets; `AnnotatedTab.tsx` / `DocumentedSource.tsx` render the actual documentation. `logic/docExport.ts` generates Markdown, opens a print window for PDF, and labels an HTML `.doc` download as DOCX. Native OOXML `.docx` is not currently implemented. Do not advertise native DOCX until separately implemented and verified.
13. **Existing tests:** Frontend and backend have Vitest suites. Playwright lives in `Frontend/playwright/tests` with all-samples, manifest, learner assessment, admin course, documented-source, screenshot and responsive tests. Several UI tests mock API responses and tokens; those are not acceptable evidence for the commercial's real end-to-end flow. Current default Playwright base URL points at the now API-only backend; AVP must use a frontend origin.
14. **Capture infrastructure:** `tools/capture-tour-screenshots.mjs` and `capture-marketing-screenshots.mjs` establish local Playwright conventions. No existing Remotion project was found in the inspected manifests/files. Reuse dependencies and actual shared UI; record 1920×1080 clean clips with state-based waits. Use longer source takes and edit their timing later.
15. **Reset:** Existing `Backend/scripts/reset-interns.mjs` and tester-seat claim/reset code must not run against evaluation data. `initDb` seeds a pilot account/plan unconditionally and optional tester accounts; isolate it and remove only the disposable pilot records. Preserve the unrelated local changes in deployment files and local configuration.

## Chosen demo-state design

Each reset creates a new `Codebase/AVP/.local/run-*` generation with a fresh SQLite database, owned marker, random local passwords/JWT secret, and isolated output paths. Credentials and captures are ignored by Git. No existing database is copied, deleted, or reset. Every environment key inherited or found in conventional application dotenv files is blanked before deliberate loopback-only settings are supplied. Supabase mirrors, OAuth, AI providers, tester seeding, scraper and Docker runners are disabled initially. The real recommendation fallback is preserved.

Path guards reject arbitrary database paths, symbolic links and hard-linked files. Normal backend authorization remains unchanged. Runtime login uses the actual `/auth/login` endpoint. Browser capture must reject external destinations and must not mock learning, analysis or recommendation APIs.

## Implementation sequence and acceptance gates

- [x] Audit the real repository and document conflicts.
- [x] Add and run path/credential-isolation tests; observe failure before implementation.
- [x] Implement non-destructive fresh-generation reset with two clean demo users.
- [x] Execute the existing Strategy fixture using the real analyzer and verify source anchors.
- [x] Execute the exact project specification through the real planner; record the actual failure to select Strategy.
- [ ] Resolve the recommendation prerequisite through an approved clarification to the specification or a properly configured real AI provider. Never alter planner rules or fabricate responses.
- [x] Launch an owned loopback backend/frontend pair with isolated outputs and ordinary authentication.
- [ ] Verify the project-learning assignment and formal assessment lifecycle through the real UI/APIs.
- [ ] Add a real Playwright flow that completes required learning and post-test legitimately.
- [ ] Capture separate project, learning, Studio, evidence and documentation clips; verify actual downloads.
- [ ] Review all clips for private information, UI defects, loading artifacts and inaccurate claims.
- [ ] Only after successful footage, add Remotion scenes and licensed/original audio preparation.
- [ ] Render and inspect a final 117-second, 1920×1080 composition; verify duration, readable text, transitions and audio.

## Current commands

From the repository root:

```sh
node --test Codebase/AVP/tests/isolation.test.mjs
npm run avp:reset
npm run avp:verify
npm run avp:preflight
npm run avp:serve
```

`verify` currently fails honestly when the supplied specification does not recommend Strategy. It first verifies the real golden fixture. Do not interpret this as finished footage or a production-ready AVP. Reset creates new generations and leaves old ones intact for review; `.local` is private local material.

`avp:preflight` owns both services, refuses occupied ports, checks ordinary admin/user login and 401/403 authorization, checks empty intern assessment history, calls the real analysis API, renders the actual Project Manager dashboard in Chromium at 1920×1080, and shuts down its services. It saves a private JSON report and screenshot. It does not bypass or complete the intern learning path. Run preflight before manually starting `avp:serve`; it deliberately will not attach to an existing service.

## Verified status and pending decision

Six AVP safety tests and six integrated preflight checks passed. Existing backend planner/seed/module-validation tests passed (16 tests); existing frontend learning-assessment/cycle tests passed (64 tests). Unrelated full application suites, final capture, exports and final video are not yet verified.

The exact original project specification remains in `Codebase/AVP/project-specification.txt`. A read-only planner probe with this proposed additional paragraph selected `behavioural-strategy` as the only non-foundation module, using the unchanged heuristic planner:

> Project managers choose different prioritization rules at runtime. Each prioritization algorithm is interchangeable behind a common interface, and the caller selects the policy without changing the project-management workflow.

This paragraph has **not** been applied to the demo specification. The pending choice is to approve that clarification or keep the exact wording and configure the existing AI planner. Do not show a successful Strategy recommendation for the unchanged original text. The local AI provider is currently unconfigured.

The runtime's C++ execution runner is disabled; analyzer-based practical detection is available, but any required compile/run assessment step must be checked before final capture. Native DOCX remains an implementation discrepancy, and the final AVP must not imply native DOCX support from the current `.doc` download.
