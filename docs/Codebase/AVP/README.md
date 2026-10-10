# CodiNeo commercial AVP — audit and implementation blueprint

## Purpose and boundaries

Produce a repeatable, truthful product demonstration before building the under-two-minute commercial. Source footage must come from the actual product. This subsystem owns disposable demo state, verification, capture, and video assembly. It does not own production authentication, learning scoring, recommendation rules, or C++ detection.

Read this audit first, then `Codebase/AVP/isolation.mjs`, `config.mjs`, `cli.mjs`, and `worker.ts`. `runtime.mjs` owns startup/shutdown, `frontend.mjs` configures the existing Vite host, and `preflight.mjs` verifies real authentication, authorization, analysis and browser rendering. The user's supplied commercial brief is the creative specification. The final composition is 116 seconds, including a six-second closing brand lockup.

## Repository audit

1. **Frontend:** React 18 components in `Codebase/Frontend/src`, Zustand state, Vite local/CI host. Production is Next.js 14 App Router in `Codebase/FrontendNext`, importing the same components. Its default API rewrite points at the live AWS backend. An AVP host must override this destination or use a dedicated Vite proxy.
2. **Backend:** Express/TypeScript in `Codebase/Backend/server.ts`; API-only. Main surfaces are `/auth`, `/api/admin`, `/api/learning`, `/api/project-learning`, `/api/analyze`, and saved runs. `FastifyService` is separate from this primary flow.
3. **Data:** `src/db/database.ts` opens SQLite using `DB_PATH`. `initDb.ts` supplies the schema and checked-in learning seed. Tables include users, learning modules/progress/attempts/answers, learning plans/modules, runs, settings and organization catalogs. Supabase supplies OAuth and optional remote mirrors; it is not the primary local runtime database.
4. **Authentication:** Google/Supabase exchange and local password login produce application JWTs. `jwtAuth.ts` verifies bearer JWTs and revocation; `requireAdmin.ts` enforces role `admin`. The commercial labels Project Manager and Intern correspond to the existing `admin` and `user` roles. Use real local password login for dedicated demo accounts; no production bypass is necessary.
5. **Project Manager:** `CoursePlanPanel.tsx` calls the real `/api/admin/course-plan` planner. Apply patches published module flags; this is shared course availability, not automatically an individual project assignment. Separate learning-plan and project-learning endpoints also exist. Verify their actual use in the capture rather than inventing a project-management screen.
6. **Recommendation:** `coursePlannerService.ts` uses a configured Gemini/Anthropic provider or its existing heuristic fallback. The exact supplied Community Project Prioritization specification was evaluated in a fresh demo database. With no local AI provider, it selected foundation modules only, not Strategy. The user subsequently approved a clarification describing runtime policies behind a common interface. With that paragraph, the unchanged planner selects Strategy and the foundation modules. No scoring rules changed.
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
- [x] Resolve the recommendation prerequisite through an approved clarification to the specification or a properly configured real AI provider. Never alter planner rules or fabricate responses.
- [x] Launch an owned loopback backend/frontend pair with isolated outputs and ordinary authentication.
- [x] Verify the actual shared course scope and formal assessment lifecycle through the real UI/APIs; document the absence of an automatic named individual assignment.
- [x] Add a real Playwright flow that completes required learning and post-test legitimately.
- [x] Capture separate project, learning, Studio, evidence and documentation clips; verify actual downloads.
- [x] Review all clips for private information, UI defects, loading artifacts and inaccurate claims.
- [x] Only after successful footage, add Remotion scenes and licensed/original audio preparation.
- [x] Render and inspect a final 116-second, 1920×1080 composition; verify duration, readable text, transitions and audio.

## Repeatable capture and video pipeline

### Reference-inspired visual revision

The third edition alternates a white/mint and near-black/lime palette at every scene boundary, with contrasting heading and annotation colors. The earlier drawn hardware is replaced by a photorealistic generated laptop mockup with a visible keyboard and trackpad. Actual capture content is composited into the measured screen rectangle without stretching. Wider device entrances, masked text reveals, animated brand pills, and circle/slab wipes follow the reference motion direction. Use `--revision v3` for its separate output.

The mockup source is versioned under `video/assets/`; `render.mjs` copies it into the ignored public media folder before bundling. It is generated decorative hardware, not a photograph of a physical device or a generated application interface. Source screen pixels still come exclusively from the verified capture.

The second visual edition uses the user's two local video references as motion/design references only. Their footage, branding, audio and embedded text are not imported. The design adds moving teal/mint atmosphere and curved background forms, desktop hardware around the genuine product captures, perspective entrances that settle for reading, staggered typography, and occasional layered detail cards taken from the same real screenshot. Device decoration belongs to the commercial; application content remains verified capture material.

Render a separate edition without replacing the first film with `npm run avp:render -- --prepared --revision v2`. Its movie, review frames and verification report live in the current demo generation's `film/v2/` folder. `npm run avp:verify-render -- --revision v2` verifies that edition. Revision names are restricted to simple folder names. The original 116-second story, source footage, real analyzer evidence and narration timing remain the same.

`capture.ts` operates the actual application with Playwright. Normal login returns the token used in browser storage. All external browser requests are blocked. Only the owned runtime launched by `cli.mjs capture` can invoke capture. The command checks both ports, creates a fresh generation, verifies the actual analyzer and planner, starts services, completes the real UI workflow, and closes services even after a failed capture.

The pre-test intentionally leaves Strategy below proficiency while answering the foundation material. The existing Post-Foundations conceptual checkpoint still gates lesson access and is completed through its real form. Strategy theory, analyzer practical, and formal post-test are also completed through their real forms. Only selected assessment interactions are edited into the commercial; answer-key reveals are excluded. Nothing writes artificial outcomes to the database.

The project-manager course plan publishes the relevant module scope; the current UI does not automatically assign a named project to an individual. The film describes project-guided learning without inventing an individual assignment record.

Video ownership is separate: `video/` holds the Remotion composition; `prepare.mjs` creates trimmed local media and original music; `render.mjs` bundles and renders the film. Generated clips, screenshots, credentials, audio and renders stay ignored locally. `video/src/index.tsx` owns reusable typography, source-code animation, diagram nodes, monitor/laptop framing and brand lockups. The composition targets 116 seconds, 1920×1080 at 30fps. Optional voice-over is supplied at render time and follows `narration.md`. No copyrighted stock music is included.

Playwright uses a 1920×1080 viewport at device scale 2: 1920×1080 VP8 source recordings plus lossless 3840×2160 PNGs of each selected final state. The larger screenshots preserve readable text during editorial zooms. Prepared clips retain normal interaction speed and extend a clean hold to eight seconds. The composition uses the real recording for actions, then its matching lossless browser screenshot for sharper held close-ups. Static result shots switch after half a second; action shots switch after three seconds. These are screenshots of the application, never recreated UI. Slow analysis clips retain the completed result and at most one second of the preceding wait, so repeated captures cannot freeze on a loading screen.

The timeline is hook 0–8s; theory 8–21s; reveal 21–29s; project workflow 29–45s; learning 45–60s; Studio 60–68s; conceptual structural diagram 68–83s; evidence 83–99s; documentation 99–110s; brand close 110–116s. `render.mjs` produces chapter review frames and renders H.264/AAC. `verify-render.mjs` checks metadata, fully decodes all 3,480 frames, and measures audio peak headroom. The video is exactly 116 seconds; AAC container padding is allowed within one 30fps frame, while the two-minute ceiling remains strict. `npm run avp:verify-render` rechecks an existing film without rendering it again. A new render clears any previous success report before starting.

```sh
npm run avp:reset
npm run avp:verify
npm run avp:preflight
npm run avp:capture
npm run avp:render
```

`avp:capture` includes its own reset; the first three commands are independently useful safety checks. Install the dedicated video package with `npm ci --prefix Codebase/AVP/video` before rendering. Existing backend/frontend dependencies and an existing supported analyzer binary are prerequisites. No C++ rebuild is invoked.

`avp:preflight` owns both services, refuses occupied ports, checks ordinary admin/user login and 401/403 authorization, checks empty intern assessment history, calls the real analysis API, renders the actual Project Manager dashboard in Chromium at 1920×1080, and shuts down its services. Run on a fresh reset before capture. Do not run while `avp:serve` is active.

## Accuracy and export limitations

The approved paragraph is in `project-specification.txt`:

> Project managers choose different prioritization rules at runtime. Each prioritization algorithm is interchangeable behind a common interface, and the caller selects the policy without changing the project-management workflow.

The planner remains the real heuristic fallback; AI providers are disabled in the demo. The code sample remains the existing compression fixture, illustrating the reusable Strategy structure in a different domain. The runtime's compiler runner is disabled; the real analyzer-based practical detection is used.

The actual export buttons read PDF, DOCX and MD. The Word control currently downloads HTML `.doc`, not native `.docx`; commercial overlay copy must say Word or documentation export, never promise native OOXML. Markdown and HTML Word content are downloaded and checked. PDF uses the actual print popup; capture verifies its content and saves that view through Chromium’s PDF printing. The motion diagram explains observed source relationships; it must not label context/delegation as standalone analyzer-emitted pattern roles.

## Verification record

The final clean generation completed the real project-manager recommendation/configuration, intern pre-test, required foundation checkpoint, Strategy lesson and conceptual assessment, analyzer practical, post-test, Studio analysis, source evidence, and three documentation export paths. No assessment outcomes or API responses were mocked. The analyzer verified the unchanged existing fixture with interface/concrete evidence and traceable anchors.

Twelve AVP tests pass (isolation, port ownership, manifests, slow-analysis editing, audio-padding tolerance, revision output paths, and pre-import worker protection). Existing backend planner/seed tests pass (13); existing frontend learning-assessment/cycle tests pass (64). The Remotion TypeScript check passes. This is targeted regression coverage, not a claim that every unrelated application suite was run. The initial six integrated preflight checks also passed.

The independent review found a slow-analysis editing edge case; it was fixed with a test preserving the completed state within the final four-second analysis scene. No production or isolation boundary issue was found. Production runtime files, authentication, recommendation rules, evaluation databases and C++ source were not changed.

Generated acceptance reports live alongside the private demo state: `capture/capture-success.json`, `prepared-media.json`, and `film/render-verification.json`. The film and chapter PNGs are in `film/`. Absence of a successful report means that stage is unverified. Keep full raw browser recordings private: they include the off-camera work required to complete the assessments.

The delivered MP4 passed full decoding at 1920×1080, 30fps, 3,480 frames and 116.011 seconds of container duration (116 seconds of video plus AAC padding). Measured audio peak is −20.3 dBFS. Nineteen chapter frames and 29 frames sampled from the final encoded MP4 were visually reviewed; close-ups, source evidence, chapter progression and brand close were inspected. This master includes original music and no spoken narration. The timed narration script and optional voice-over input are ready for later recording.

The v2 device-framed edition passed the same full decode, duration and audio checks. Nineteen chapter frames, 29 samples from the encoded MP4 and 12 consecutive transition samples were visually inspected. The independent code/layout review found no blocking concern. The original master remains in `film/`; the revised master and its acceptance record are in `film/v2/`.

The v3 photorealistic-laptop edition passed 12 AVP tests and the Remotion typecheck, plus full output decoding: 1920×1080, 30fps, 3,480 frames, 116.011 seconds including AAC padding, and −20.3 dBFS audio peak. Nineteen chapter frames, 29 encoded-film samples and 28 samples across both transition styles were inspected. Independent review found no blocking contrast, evidence or overflow issue. `film/v3/` holds the separate master and report.
