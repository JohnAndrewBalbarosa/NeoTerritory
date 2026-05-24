// Single source of tour content. Per Sprint 0 doc blueprint:
// docs/Codebase/Frontend/src/components/marketing/tour/TourPage.tsx.md.
// The /tour public page reads this. The future in-studio popup walkthrough
// (D45 follow-up) will read the same file so the two never drift.
//
// Scope per user direction: the tour mirrors the studio tab walkthrough —
// sign-in is not part of the studio, and the save-the-run + open-history
// flows live inside the run-history surface (not on a studio tab), so they
// are intentionally omitted from this tour.
//
// The Self-check step was dropped from this public walkthrough per user
// direction: the Self-check tab is an admin-gated (thesis-mode) surface, not
// part of the default studio flow, so it no longer belongs in the
// "how it works" narrative. The tab still exists in the studio code behind
// the thesis-mode setting; only its tour entry + screenshot were removed.

export interface TourStep {
  num: number;
  slug: string;
  title: string;
  paragraph: string;
  takeaway: string;
  // Path to a screenshot under Codebase/Frontend/public/tour/.
  // null when no screenshot exists yet — the page renders an SVG diagram fallback.
  imagePath: string | null;
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    num: 1,
    slug: 'land-on-submit',
    title: 'Land in the Submit tab',
    paragraph:
      'The Submit tab is where every analysis starts. On your first visit, a Start Here rail appears above the editor with three numbered steps. The rail collapses to a small pill once you have run your first analysis, but it stays around as a re-open affordance.',
    takeaway: 'You always know where to begin.',
    imagePath: '/tour/land-on-submit.png',
  },
  {
    num: 2,
    slug: 'load-a-sample',
    title: 'Load a sample',
    paragraph:
      'Click "Load sample" to drop a real-world C++ snippet into the editor. Samples are organised by pattern family so you can pick one matching what you want to learn. Samples are full files, not toys — they exercise the matcher the way a real submission would.',
    takeaway: 'No need to write C++ from scratch to see how the system works.',
    imagePath: '/tour/load-a-sample.png',
  },
  {
    num: 3,
    slug: 'click-analyze',
    title: 'Click Analyze',
    paragraph:
      'Press the Analyze button under the editor. The C++ microservice spawns, parses your file, builds the virtual parse tree, runs every pattern detector in the catalog, and emits a structural report. Typical run time: under a second for files up to a thousand lines.',
    takeaway: 'A single click drives the whole detection pipeline.',
    imagePath: '/tour/click-analyze.png',
  },
  {
    num: 4,
    slug: 'read-the-card',
    title: 'Read the pattern card',
    paragraph:
      'Each detected pattern appears as its own card. The card shows the pattern name, the class it was found in, the line range, and the evidence anchors. When two patterns co-emit on the same class — common for Adapter / Proxy / Decorator — the card flags the ambiguity and the AI doc layer disambiguates.',
    takeaway: 'You see what was detected and why, with line-level pointers.',
    imagePath: '/tour/read-the-card.png',
  },
  {
    num: 5,
    slug: 'run-tests',
    title: 'Run the unit tests',
    paragraph:
      'The Tests tab applies the Testing-Trophy strategy to your submission: static analysis (cppcheck), compile-and-run, and per-pattern unit-test scaffolds. One click streams every phase verdict back live, with a per-class pass/fail tree on the left and the gdb / stdout / stderr panes on the right.',
    takeaway: 'Three test phases, every pattern, one click.',
    imagePath: '/tour/run-tests.png',
  },
  {
    num: 6,
    slug: 'generate-docs',
    title: 'Generate documentation',
    paragraph:
      'The Docs tab assembles the auto-generated pattern documentation — class-by-class explanations, evidence anchors back to your source lines, and AI commentary when an AI provider is configured. Export buttons (MD / PDF / DOCX) ship the same content as the printable view.',
    takeaway: 'Documentation always lands, AI on or off.',
    imagePath: '/tour/generate-docs.png',
  },
];
