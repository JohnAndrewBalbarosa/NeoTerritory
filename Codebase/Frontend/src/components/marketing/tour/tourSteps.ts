// Single source of tour content for the /tour ("Guide") page.
//
// Product direction (2026-06): CodiNeo is a LEARNING product. The guide now
// mirrors the current learner UI: a pre-test gate, a centered "Learning Path"
// topbar, a left rail that highlights the active leaf, leaf-level lesson pages,
// a green submit state for the final theoretical step, and raw-only post-test
// storage that stays interpretive in the browser.

export interface TourStep {
  num: number;
  slug: string;
  title: string;
  paragraph: string;
  takeaway: string;
  // Path to a screenshot under public/tour/. null renders a labelled placeholder.
  imagePath: string | null;
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    num: 1,
    slug: 'pre-test-gate',
    title: 'Clear the pre-test gate',
    paragraph:
      'Every learner now starts with a baseline check. The browser scores the answers locally, and only the raw selections are saved. Once the pre-test is done, the app routes straight into the learning path and keeps the gate closed on revisit until that check exists for the current session.',
    takeaway: 'Finish the baseline once, then the learning path opens automatically.',
    imagePath: '/tour/learn-path.png',
  },
  {
    num: 2,
    slug: 'enter-the-path',
    title: 'Enter the learning path',
    paragraph:
      'The page now opens at the leaf level instead of the top category list. The title lives in the topbar, the sidebar highlights the exact leaf you are on, and the old module rail under the title is gone. That keeps the content and the outline in the same place instead of letting them drift apart.',
    takeaway: 'The outline and the page now point at the same leaf.',
    imagePath: '/tour/learn-lesson.png',
  },
  {
    num: 3,
    slug: 'drill-into-module',
    title: 'Drill into a module',
    paragraph:
      'From categories to modules to lesson pages, the path drills downward one level at a time. Intro, Concepts, Examples, and the exam pages all live inside the same module shell, so the arrows only move within that module until the current leaf is done.',
    takeaway: 'The module tree is now a drill-down flow, not a dropdown menu.',
    imagePath: '/tour/learn-exam.png',
  },
  {
    num: 4,
    slug: 'theoretical-exam',
    title: 'Pass the theoretical exam',
    paragraph:
      'The final theoretical page now uses the Next arrow as the submit action. It turns green when you are on the submit step, and the client checks the correctIndex locally before saving only the raw answer rows to the database. No derived score is stored server-side.',
    takeaway: 'The submit state lives in the arrow, not in a separate button.',
    imagePath: '/tour/learn-practical.png',
  },
  {
    num: 5,
    slug: 'post-test-raw',
    title: 'Finish the practical and post-tests',
    paragraph:
      'Pattern modules still open an embedded practical Studio when needed, but the page is now framed as part of the learning path instead of a separate developer mode. The post-test and post-test-2 pages reuse the module bank as well: the browser interprets the results, while the backend stores raw selected answers and assessment metadata only.',
    takeaway: 'Practical checks stay embedded; post-tests stay raw.',
    imagePath: '/tour/learn-path.png',
  },
];
