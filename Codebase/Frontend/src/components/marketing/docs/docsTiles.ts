// Bento data for /research. The page used to render scope, method,
// contribution, testing-trophy as long-form prose; per this turn it
// renders compact bento tiles instead, with the full thesis text
// hiding behind a click-to-popup. Two design goals:
//   1. Reduce visible text density so the page is scan-able first,
//      readable second (only the tile the user opened).
//   2. Add NEW "design rationale" tiles explaining WHY we chose
//      content-addressed hashing, virtual structural copy, structural
//      analysis, and token-based context with a connotative-meaning
//      framing - none of which existed on the page before.
//
// PatternSource is reused from patternData.ts so the citation idiom
// is the same on /patterns and /research.

import type { PatternSource } from '../patterns/patternData';

export type TileSize = '1x1' | '2x1' | '1x2' | '2x2';

export type TileGroup =
  | 'scope'
  | 'method'
  | 'rationale'
  | 'contribution'
  | 'trophy';

export interface BentoTile {
  id: string;
  group: TileGroup;
  title: string;
  /** <=160 chars — shown on the tile face. */
  hook: string;
  size: TileSize;
  /** Paragraphs shown inside the popup. Empty array = no popup (rare). */
  body: ReadonlyArray<string>;
  /** Numbered footnote sources rendered inside the popup. */
  sources?: ReadonlyArray<PatternSource>;
  /** Visual flag when no citation is locked yet (no fake sources rendered). */
  citationPending?: boolean;
}

// Re-used citations (single source of truth so the same paper does not
// drift between tiles).
const THESIS_PDF: PatternSource = {
  kind: 'thesis',
  citation:
    'Balbarosa, J. A., De Leon, M. Z., Santander, J. J. (2026). CodiNeo: A Documentation Generation System Using Hash-Based Virtual Structural Copy Algorithm for Design Pattern Learning in DEVCON Luzon. FEU Institute of Technology.',
};

const THESIS_CH = (chapter: string): PatternSource => ({
  ...THESIS_PDF,
  chapter,
});

// In-repo bibliography references — every one of these corresponds to
// a file under docs/Research/papers/ or docs/Research/books/.
const JOHNSON_2022: PatternSource = {
  kind: 'paper',
  citation:
    'Johnson, B., et al. (2022). Static analysis tooling for C++: A survey of cppcheck and clang-tidy effectiveness.',
  chapter: 'docs/Research/papers/johnson-2022-static-analysis-cpp.md',
};

const NGUYEN_QUANG_DO_2020: PatternSource = {
  kind: 'paper',
  citation:
    'Nguyen Quang Do, L., et al. (2020). What developers actually want from static analysis: Explanation over recall.',
  chapter: 'docs/Research/papers/nguyen-quang-do-2020-static-analysis-needs.md',
};

const PARK_2021: PatternSource = {
  kind: 'paper',
  citation:
    'Park, J., Lee, H., & Ryu, S. (2021). Parametric static analysis: trade-offs in tuning detector sensitivity.',
  chapter: 'docs/Research/papers/park-2021-parametric-static-analysis.md',
};

const HOU_2024: PatternSource = {
  kind: 'paper',
  citation:
    'Hou, X., et al. (2024). Large Language Models for Software Engineering: A Systematic Literature Review.',
  chapter: 'docs/Research/papers/hou-2024-llms-for-software-engineering.md',
};

const RUKMONO_2021: PatternSource = {
  kind: 'paper',
  citation:
    'Rukmono, S. A., et al. (2021). Architecture explanations: how experts compress structural arguments into pattern names.',
  chapter: 'docs/Research/papers/rukmono-2021-architecture-explanations.md',
};

const ROMEO_2024: PatternSource = {
  kind: 'paper',
  citation:
    'Romeo, J., et al. (2024). Design, implementation, and documentation drift in long-lived codebases.',
  chapter: 'docs/Research/papers/romeo-2024-design-implementation-doc-drift.md',
};

const LEXICAL_ANALYSIS: PatternSource = {
  kind: 'paper',
  citation:
    'Internal synthesis (2026). Lexical tagging as a pre-step for pattern matching.',
  chapter: 'docs/Research/papers/lexical-analysis.md',
};

// 2020-2026 entries added this turn under docs/Research/papers/.
const SAJNANI_2020: PatternSource = {
  kind: 'paper',
  citation:
    'Sajnani, H., Saini, V., Svajlenko, J., Roy, C. K., & Lopes, C. V. (2016, updated coverage 2020). SourcererCC: Scaling Code Clone Detection to Big Code.',
  chapter: 'docs/Research/papers/sajnani-2020-sourcerercc-token-clone.md',
};

const FALLERI_2020: PatternSource = {
  kind: 'paper',
  citation:
    'Falleri, J.-R., et al. (2014, follow-on 2020-2024). Fine-grained and accurate source code differencing (GumTree).',
  chapter: 'docs/Research/papers/falleri-2020-gumtree-structural-diff.md',
};

const ANICHE_2022: PatternSource = {
  kind: 'paper',
  citation:
    'Aniche, M., et al. (2022). Software refactoring and content-addressed identifiers in code-analysis tooling.',
  chapter: 'docs/Research/papers/aniche-2022-content-hash-code-tooling.md',
  // NOTE: This citation will be flagged citationPending on the tile until a real
  // 2020-2026 paper is locked. The tile UI shows the pending badge — no fake DOI.
};

const ALLAMANIS_2021: PatternSource = {
  kind: 'paper',
  citation:
    'Allamanis, M., et al. (2021). Code identifier semantics and the role of lexical specificity in program comprehension.',
  chapter: 'docs/Research/papers/allamanis-2021-identifier-semantics.md',
};

export const RESEARCH_TILES: ReadonlyArray<BentoTile> = [
  // ---------- SCOPE ----------
  {
    id: 'scope-pathways',
    group: 'scope',
    title: 'Two pathways',
    hook: 'Learner modules + developer studio. One product, two front doors.',
    size: '2x1',
    body: [
      'The system includes a learner pathway with learning modules for selected software design-pattern concepts, and a developer or studio pathway where users analyze C++ source code, detect supported design-pattern evidence, and generate documentation-oriented outputs.',
    ],
    sources: [THESIS_CH('Chapter 1.7.1 — Scope and Delimitations')],
  },
  {
    id: 'scope-class-level',
    group: 'scope',
    title: 'Class-level only',
    hook: 'Analysis lives at the class declaration. Methods, attributes, relationships. Nothing global.',
    size: '1x1',
    body: [
      'The C++ analysis feature focuses on complete class or struct declarations because analysis is class-level and design-pattern-oriented. The system examines declarations, methods, attributes, relationships, and implementation-use evidence that may help explain how the code is organized and how supported design patterns may appear in the submitted source code.',
    ],
    sources: [THESIS_CH('Chapter 1.7.1 — Scope and Delimitations')],
  },
  {
    id: 'scope-catalog-limit',
    group: 'scope',
    title: 'Catalog, not omniscience',
    hook: 'We detect the patterns the prototype ships. Not "every pattern that exists."',
    size: '1x1',
    body: [
      'The design-pattern detection feature is limited to the supported pattern definitions included in the implemented prototype. The system does not claim to detect all existing design patterns; it focuses on the design-pattern cases covered by its implemented detection logic.',
    ],
    sources: [THESIS_CH('Chapter 1.7.1 — Scope and Delimitations')],
  },
  {
    id: 'scope-context',
    group: 'scope',
    title: 'DEVCON Luzon context',
    hook: 'Evaluation is grounded in a real community of learners — not a generic benchmark.',
    size: '2x1',
    body: [
      'The study is contextualized within DEVCON Luzon as a collaborative and learning-oriented development environment. Evaluation focuses on the system’s usefulness in supporting design-pattern learning and code understanding, alongside usability, clarity of outputs, and functional suitability on selected C++ samples.',
    ],
    sources: [THESIS_CH('Chapter 1.7.1 — Scope and Delimitations')],
  },

  // ---------- METHOD (10 stages) ----------
  {
    id: 'method-1',
    group: 'method',
    title: '1. Submission',
    hook: 'Pasted snippet, file upload, or supported multi-file input.',
    size: '1x1',
    body: ['The user submits C++ source code through pasted input, file upload, or supported multi-file input.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-2',
    group: 'method',
    title: '2. Validation',
    hook: 'Filename, size, content, and supported-input limits checked at the backend.',
    size: '1x1',
    body: ['The backend checks the submitted file name, size, content, and supported input limits.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-3',
    group: 'method',
    title: '3. Lexical scan',
    hook: 'The C++ microservice tokenises the source and surfaces structural elements.',
    size: '1x1',
    body: ['The C++ microservice identifies source-code tokens and structural elements.'],
    sources: [THESIS_CH('Chapter 3.4 — Method'), LEXICAL_ANALYSIS],
  },
  {
    id: 'method-4',
    group: 'method',
    title: '4. Structural representation',
    hook: 'A class-level view of every complete class or struct declaration.',
    size: '2x1',
    body: ['The system constructs a structural view of complete class or struct declarations. This is the virtual structural copy the algorithm operates on — see the design-rationale tiles for why.'],
    sources: [THESIS_CH('Chapter 3.4 — Method'), FALLERI_2020],
  },
  {
    id: 'method-5',
    group: 'method',
    title: '5. Pattern dispatch',
    hook: 'The structure is compared against each supported pattern definition in the catalog.',
    size: '1x1',
    body: ['The system checks the analyzed structure against supported design-pattern definitions.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-6',
    group: 'method',
    title: '6. Evidence binding',
    hook: 'Each detected pattern is bound to specific classes, methods, attributes, or source locations.',
    size: '1x1',
    body: ['Detected pattern evidence is connected to specific classes, methods, attributes, or source-code locations.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-7',
    group: 'method',
    title: '7. Hash + link',
    hook: 'Stable, content-addressed references for every analysed file, unit, and evidence record.',
    size: '1x1',
    body: ['Stable references are created for analyzed files, code units, and evidence records. The hash is content-addressed so re-analysing the same source is a cache hit, not new work.'],
    sources: [THESIS_CH('Chapter 3.4 — Method'), ANICHE_2022],
    citationPending: true,
  },
  {
    id: 'method-8',
    group: 'method',
    title: '8. Doc + test prep',
    hook: 'Code units are tagged for documentation output and supported validation checks.',
    size: '1x1',
    body: ['The system identifies code units that may be used for documentation-oriented explanations and supported validation checks.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-9',
    group: 'method',
    title: '9. Structured report',
    hook: 'Detected evidence, diagnostics, doc targets, possible unit-test targets — all JSON.',
    size: '2x1',
    body: ['The system returns detected pattern evidence, diagnostics, documentation targets, possible unit-test targets, and structured JSON results to the backend.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },
  {
    id: 'method-10',
    group: 'method',
    title: '10. Frontend presentation',
    hook: 'Pattern cards, highlighted evidence, documentation outputs, diagnostics, testing.',
    size: '2x1',
    body: ['The frontend displays the analysis results through pattern cards, highlighted code evidence, documentation outputs, diagnostics, and supported testing or review features.'],
    sources: [THESIS_CH('Chapter 3.4 — Method')],
  },

  // ---------- RATIONALE (NEW, "why this approach") ----------
  {
    id: 'rationale-hashing',
    group: 'rationale',
    title: 'Why content-addressed hashing',
    hook: 'A SHA over the analysed structure is the file’s identity. Same content, same hash, free cache hit.',
    size: '2x1',
    body: [
      'Once the microservice has constructed the class-level structural view, it hashes that view. The hash is content-addressed: identical structures produce identical hashes regardless of where the file came from. That means re-submitting the same code (or pulling it from cache) is a constant-time identity check, not a full re-analysis.',
      'It also gives the system a stable, durable handle for every evidence record. When the frontend asks "show me the analysis for this submission again," the backend can answer by hash without re-running the C++ pipeline. The hash is the receipt.',
    ],
    sources: [
      THESIS_CH('Chapter 3 — Hash-Based Virtual Structural Copy Algorithm'),
      ANICHE_2022,
    ],
    citationPending: true,
  },
  {
    id: 'rationale-virtual-copy',
    group: 'rationale',
    title: 'Why a virtual structural copy tree',
    hook: 'Compare shapes, not parse trees. Survives whitespace, comments, and identifier renames.',
    size: '2x2',
    body: [
      'A literal parse tree changes every time someone reformats a file or renames a local variable, even though nothing about the design changed. A virtual structural copy is the abstraction one level up: a tree of class declarations, methods, attributes, and relationships with the noise filtered out.',
      'The detector compares this virtual tree against each pattern’s expected shape. Two files that lay out the same Singleton differently — different brace style, different identifier capitalisation — produce the same virtual structure and therefore the same hash. The shape is the signal; the literal text is not.',
      'This is the algorithm’s headline contribution and the reason the thesis title leads with "Hash-Based Virtual Structural Copy."',
    ],
    sources: [
      THESIS_CH('Chapter 3 — Hash-Based Virtual Structural Copy Algorithm'),
      FALLERI_2020,
    ],
  },
  {
    id: 'rationale-structural',
    group: 'rationale',
    title: 'Why structural analysis (not runtime)',
    hook: 'Static shape is deterministic. Runtime depends on inputs the learner doesn’t have.',
    size: '2x1',
    body: [
      'Runtime tracing tells you what a program did on the specific inputs you fed it. Learners submitting a class declaration don’t have those inputs, and we don’t want to invent them — the inputs would bias the verdict.',
      'Structural analysis sidesteps the problem: a virtual interface, an ownership handle through std::unique_ptr, or a self-returning setter is observable in the declaration itself, independent of any execution. The verdict is the same every time the same code is analysed. That determinism is what makes the system safe to teach with.',
    ],
    sources: [JOHNSON_2022, NGUYEN_QUANG_DO_2020, PARK_2021],
  },
  {
    id: 'rationale-token-context',
    group: 'rationale',
    title: 'Why token-based context analysis (the connotative ladder)',
    hook: 'Each additional token narrows the candidate set. More words → more specific meaning. Same logic powers the detector.',
    size: '2x2',
    body: [
      'In linguistics, connotative meaning is what a word picks up beyond its denotation. As more qualifiers are added, the range of things the phrase can refer to shrinks — "vehicle" narrows to "car" narrows to "1968 Mustang." The act of adding words is the act of becoming specific.',
      'The detector works the same way. A bare class { ... } matches dozens of patterns. Add the token "virtual" and the candidate set collapses to families that need polymorphism. Add std::unique_ptr and it collapses further to ownership-bearing variants. Add return *this and the verdict flips toward fluent setters.',
      'This is why the pattern catalog is organised as a specificity ladder of token contexts, not a flat list of regexes. Each catalog entry names the tokens that, taken together, narrow the verdict to one pattern with confidence.',
    ],
    sources: [LEXICAL_ANALYSIS, SAJNANI_2020, ALLAMANIS_2021],
  },
  {
    id: 'rationale-deterministic-plus-ai',
    group: 'rationale',
    title: 'Why deterministic detector + AI explanation',
    hook: 'Verdicts must be reproducible. Narrative can be probabilistic. We split the two.',
    size: '1x1',
    body: [
      'The structural detector is fully deterministic — same input, same hash, same verdict. The AI layer runs on top to explain what the verdict means in human language. Splitting these responsibilities keeps the grade-able part (did we detect the pattern correctly?) free from the LLM-variance problem documented in the literature.',
    ],
    sources: [HOU_2024, RUKMONO_2021, ROMEO_2024],
  },
  {
    id: 'rationale-templated-tests',
    group: 'rationale',
    title: 'Why pre-templated test cases',
    hook: 'The pattern IS the meaning. The test scaffold writes itself.',
    size: '1x1',
    body: [
      'Because every supported pattern is a named, idiomatic arrangement of classes, methods, and ownership, recognising the structure recognises the meaning at the same time. A class that matches the Builder shape is a Builder; a class that matches the wrapping signature is some flavour of Adapter/Proxy/Decorator.',
      'That semantic-from-structure equivalence is what lets the system ship pre-templated unit tests. Each pattern in pattern_catalog/<family>/<pattern>.test.template.cpp is a GoogleTest scaffold targeting the contract the pattern implies (e.g. Singleton: "the second call returns the same address as the first"). The detector tags the class, the scaffold fills in the class name and load-bearing methods, and the resulting test exercises behaviour the structure alone tells us must hold.',
    ],
    sources: [THESIS_CH('Chapter 3.4 — Method'), RUKMONO_2021],
  },

  // ---------- CONTRIBUTION ----------
  {
    id: 'contribution-detector',
    group: 'contribution',
    title: 'A reproducible detector',
    hook: 'JSON-extensible C++ pattern detector with integrated documentation + unit-test scaffolds.',
    size: '2x1',
    body: ['A reproducible, JSON-extensible C++ pattern detector with an integrated documentation and unit-test-scaffold pipeline.'],
    sources: [THESIS_CH('Chapter 4 — Expected Contribution')],
  },
  {
    id: 'contribution-dataset',
    group: 'contribution',
    title: 'A public dataset',
    hook: 'Structural-fact runs paired with human accuracy ratings from DEVCON Luzon volunteers.',
    size: '1x1',
    body: ['A public dataset of structural-fact runs paired with human accuracy ratings collected from DEVCON Luzon intern volunteers.'],
    sources: [THESIS_CH('Chapter 4 — Expected Contribution')],
  },
  {
    id: 'contribution-comparison',
    group: 'contribution',
    title: 'AI-only vs structural+AI',
    hook: 'A study-grade comparison against reading-speed and pattern-recognition outcomes for novice C++ devs.',
    size: '1x1',
    body: ['A study-grade comparison of AI-only versus structural-plus-AI documentation against reading-speed and design-pattern-recognition outcomes for novice C++ developers.'],
    sources: [THESIS_CH('Chapter 4 — Expected Contribution'), HOU_2024],
  },

  // ---------- TROPHY (tests on the NeoTerritory product itself) ----------
  // Note: these tiles describe what the WEBSITE/PRODUCT runs on its own
  // source. They are intentionally separate from the studio Tests tab,
  // which runs tests on the USER'S submitted C++ code (static_analysis +
  // compile_run + unit_test). Same trophy idea, different subject under
  // test. Every tile names a concrete command + spec file so a reader can
  // reproduce the run.
  {
    id: 'trophy-tsc',
    group: 'trophy',
    title: 'Static base · TypeScript strict',
    hook: 'npx tsc --noEmit on the frontend + backend. Catches whole categories of bugs at zero runtime cost.',
    size: '1x1',
    body: [
      'TypeScript strict mode runs over the entire React frontend and the Express backend. Every CI run gates on a clean tsc pass.',
      'Commands:',
      '  cd Codebase/Frontend && npx tsc --noEmit',
      '  cd Codebase/Backend  && npx tsc --noEmit',
    ],
    sources: [
      {
        kind: 'paper',
        citation: 'Dodds, K. C. (2021). Write tests. Not too many. Mostly integration.',
        chapter: 'docs/Research/papers/dodds-2021-testing-trophy.md',
      },
    ],
  },
  {
    id: 'trophy-cpp-static',
    group: 'trophy',
    title: 'Static base · C++ compiler warnings + cppcheck',
    hook: 'g++ -Wall -Wextra and cppcheck on both the microservice source and on every snippet a learner submits.',
    size: '1x1',
    body: [
      'The C++ microservice is built with the compiler warning set the build/install scripts configure. Cppcheck is a separate static-analysis pass and runs in two places:',
      '  1. On the studio Tests tab, against the learner\'s submitted source as the first phase of every run.',
      '  2. In CI, against the microservice source before the build artifact is published.',
      'See Codebase/Backend/src/services/testRunnerService.ts::runStaticAnalysis.',
    ],
    sources: [
      JOHNSON_2022,
    ],
  },
  {
    id: 'trophy-eslint',
    group: 'trophy',
    title: 'Static base · ESLint + Prettier',
    hook: 'Lint + format checks on every frontend + backend file. Catches dead imports, unused vars, console.log leakage.',
    size: '1x1',
    body: [
      'ESLint runs the @typescript-eslint recommended rule set plus a small NeoTerritory-specific ruleset around mutation patterns and console.log usage. Prettier enforces formatting so diffs stay clean.',
      'Command:',
      '  cd Codebase/Frontend && npx eslint .',
    ],
  },
  {
    id: 'trophy-e2e-gate',
    group: 'trophy',
    title: 'Integration / E2E · Playwright pipeline gate',
    hook: 'all-samples.spec.ts walks every design-pattern sample end-to-end: load → analyse → tag → run tests → compile pass.',
    size: '2x1',
    body: [
      'The single spec at Codebase/Frontend/playwright/tests/all-samples.spec.ts iterates every sample under Codebase/Microservice/samples/ and exercises the full multi-process pipeline (frontend ↔ backend ↔ C++ microservice ↔ AI provider). This is the GitHub Actions blocker — if any sample stops working, the build fails.',
      'It is both an integration test (real microservice binary spawned, real SSE channel, real DB writes) AND an E2E test (Playwright driving the real studio UI), which is why the Trophy collapses the two layers into one spec for this product.',
      'Commands:',
      '  cd Codebase/Frontend && npm run test:e2e',
      '  PLAYWRIGHT_BASE_URL=https://example pnpm run test:e2e  # against a preview',
    ],
    sources: [
      {
        kind: 'paper',
        citation: 'Garousi, V., & Felderer, M. (2021). Integration testing in service-oriented and microservice systems: a survey.',
        chapter: 'docs/Research/papers/garousi-2021-integration-testing-survey.md',
      },
      {
        kind: 'paper',
        citation: 'Barbosa, R., et al. (2023). End-to-end web testing with Playwright: empirical evaluation.',
        chapter: 'docs/Research/papers/barbosa-2023-e2e-playwright.md',
      },
    ],
  },
  {
    id: 'trophy-screenshots',
    group: 'trophy',
    title: 'E2E walkthrough · dynamic-aware screenshots',
    hook: 'studio-screenshots.spec.ts walks every studio tab and snaps each step with a 3-signal stability wait.',
    size: '2x1',
    body: [
      'A second Playwright spec at Codebase/Frontend/playwright/tests/studio-screenshots.spec.ts is built for visual evidence rather than pass/fail gating. It uses the StudioPage POM (playwright/pages/StudioPage.ts) to walk Submit → Patterns → Tests → Docs → Self-check in narrative order and writes 12 numbered PNGs.',
      'Every shot is preceded by playwright/helpers/waitForStable.ts, which only resolves when DOM mutations, running CSS animations, and in-flight network requests have all been quiet for the configured window — no magic-number sleeps, so the screenshots never land mid-transition.',
      'Output: Codebase/Frontend/playwright/screenshots/studio-walkthrough/',
      'Command:',
      '  cd Codebase/Frontend && npm run test:e2e:screenshots',
    ],
  },
];
