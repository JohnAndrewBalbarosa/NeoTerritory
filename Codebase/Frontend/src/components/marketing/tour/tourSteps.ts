// Single source of tour content. Per Sprint 0 doc blueprint:
// docs/Codebase/Frontend/src/components/marketing/tour/TourPage.tsx.md.
// The /tour public page reads this. The future in-studio popup walkthrough
// (D45 follow-up) will read the same file so the two never drift.

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
    slug: 'sign-in',
    title: 'Sign in',
    paragraph:
      'Sign in with Google or use a tester credential. Why we ask: to save your runs so you can come back to them and see your progress over time. Reading the public site does not require sign-in — only saving runs does.',
    takeaway: 'Your future runs land under your account, not in a shared bucket.',
    imagePath: null,
  },
  {
    num: 2,
    slug: 'land-on-submit',
    title: 'Land in the Submit tab',
    paragraph:
      'The Submit tab is where every analysis starts. On your first visit, a Start Here rail appears above the editor with three numbered steps. The rail collapses to a small pill once you have run your first analysis, but it stays around as a re-open affordance.',
    takeaway: 'You always know where to begin.',
    imagePath: null,
  },
  {
    num: 3,
    slug: 'load-a-sample',
    title: 'Load a sample',
    paragraph:
      'Click "Load sample" to drop a real-world C++ snippet into the editor. Samples are organised by pattern family so you can pick one matching what you want to learn. Samples are full files, not toys — they exercise the matcher the way a real submission would.',
    takeaway: 'No need to write C++ from scratch to see how the system works.',
    imagePath: null,
  },
  {
    num: 4,
    slug: 'click-analyze',
    title: 'Click Analyze',
    paragraph:
      'Press the Analyze button under the editor. The C++ microservice spawns, parses your file, builds the virtual parse tree, runs every pattern detector in the catalog, and emits a structural report. Typical run time: under a second for files up to a thousand lines.',
    takeaway: 'A single click drives the whole detection pipeline.',
    imagePath: null,
  },
  {
    num: 5,
    slug: 'read-the-card',
    title: 'Read the pattern card',
    paragraph:
      'Each detected pattern appears as its own card. The card shows the pattern name, the class it was found in, the line range, and the evidence anchors. When two patterns co-emit on the same class — common for Adapter / Proxy / Decorator — the card flags the ambiguity and the AI doc layer disambiguates.',
    takeaway: 'You see what was detected and why, with line-level pointers.',
    imagePath: null,
  },
  {
    num: 6,
    slug: 'generate-docs',
    title: 'Generate documentation',
    paragraph:
      'Press "Generate documentation" to trigger the AI doc job. The job runs in chunks (max five per run) so you see progress instead of a frozen spinner. If the AI is unavailable or times out, NeoTerritory falls back to static documentation built from the catalog templates — no run ever ends with nothing.',
    takeaway: 'Documentation always lands, AI on or off.',
    imagePath: null,
  },
  {
    num: 7,
    slug: 'save-the-run',
    title: 'Save the run',
    paragraph:
      'Submit your per-run review (a quick five-star accuracy rating). The run record and the review cascade together — deleting a run automatically deletes its review. Reviews exist so we can see which patterns the system gets right and which need work.',
    takeaway: 'Your feedback drives the next iteration of the catalog.',
    imagePath: null,
  },
  {
    num: 8,
    slug: 'open-history',
    title: 'Open run history',
    paragraph:
      'Every saved run is replayable from the run list. Clicking a run loads its source, its detections, its documentation, and your review back into the studio. You can compare versions of the same file and see whether your refactor improved the readability score.',
    takeaway: 'Your work persists. You can always come back to it.',
    imagePath: null,
  },
];
