// Single source of tour content for the /tour ("Guide") page.
//
// Product direction (2026-05-29): CodiNeo is a LEARNING product. There is no
// standalone "developer mode" — the Studio still exists but only as a wrapper
// used inside a module's Practical Exam (where the analyser checks that the
// learner implemented the target pattern). So this Guide walks through the
// LEARNING PATH (pick a module → read → theoretical exam → practical exam →
// unlock the next), not a standalone studio. The Studio appears as one step:
// the practical-exam checking surface.

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
    slug: 'pick-a-module',
    title: 'Start on the learning path',
    paragraph:
      'Everything happens on one guided path. It opens with Foundations, then walks the four Gang-of-Four pattern families — Creational, Structural, Behavioural, and Idioms. You move through modules in order; finishing one unlocks the next, so you always know exactly where to go.',
    takeaway: 'One guided path, start to finish — nothing to set up.',
    imagePath: '/tour/learn-path.png',
  },
  {
    num: 2,
    slug: 'read-the-module',
    title: 'Read the module',
    paragraph:
      'Each module reads Intro → Concepts → Examples. Concepts are explained in plain language with key terms, and the examples are real C++ — the same kind of code the analyser was built to read. The folder sidebar lets you jump straight to any section.',
    takeaway: 'Concepts first, in plain language, with code you can actually read.',
    imagePath: '/tour/learn-lesson.png',
  },
  {
    num: 3,
    slug: 'theoretical-exam',
    title: 'Pass the theoretical exam',
    paragraph:
      'Every module ends with a multiple-choice exam. Answer all questions correctly to pass — each answer comes with an explanation of why it is right or wrong, so a miss sends you back to the exact concept to re-read.',
    takeaway: 'You prove you understood the ideas before moving on.',
    imagePath: '/tour/learn-exam.png',
  },
  {
    num: 4,
    slug: 'practical-exam',
    title: 'Prove it in the practical exam',
    paragraph:
      'Pattern modules add a practical exam inside the built-in Studio. Write (or paste) your C++ implementation and run the analyser — the module unlocks the moment it detects the target pattern in your code. The Studio is just the checking surface here: no separate developer mode, no project to wire up.',
    takeaway: 'You implement the pattern for real, and the analyser confirms it.',
    imagePath: '/tour/click-analyze.png',
  },
  {
    num: 5,
    slug: 'unlock-next',
    title: 'Unlock the next module',
    paragraph:
      'Completing a module — its theoretical exam, plus the practical exam where one exists — unlocks the next. Signed-in learners keep their progress across devices; guests keep it for the current visit. The progress bar up top tracks how far along the whole path you are.',
    takeaway: 'Linear progress that remembers where you left off.',
    imagePath: '/tour/learn-path.png',
  },
];
