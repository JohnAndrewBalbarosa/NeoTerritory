// Compact "What this study is about" block on the landing page.
// One short summary paragraph (compressing the 5 research questions
// into a sentence) + 3 plain-language objectives. The full thesis text
// (problem statement, objectives, scope, method) lives on /docs.
//
// Extracted into its own component per user direction this turn: the
// landing-page file (HeroLanding.tsx) should stay a thin composition
// shell; UI/HTML blocks live in their own files under sections/.

import { navigate } from '../../../logic/router';

const OBJECTIVES_SHORT: ReadonlyArray<string> = [
  'Detect supported design-pattern evidence in C++ source code from class-level structure alone.',
  'Generate documentation-oriented outputs that help learners connect pattern names to actual code.',
  'Evaluate usefulness with DEVCON Luzon interns on design-pattern learning and code understanding.',
];

export default function HomeStudySummary() {
  return (
    <section className="nt-home__study" aria-labelledby="home-study-heading">
      <div className="nt-home__study-inner">
        <p className="nt-section-eyebrow">The study</p>
        <h2 id="home-study-heading" className="nt-home__study-title">
          What this thesis is about
        </h2>
        <p className="nt-home__study-lede">
          CodiNeo helps beginners learn software design patterns by reading their C++ source code,
          detecting supported pattern evidence at the class level, and explaining the structure in
          documentation-oriented outputs &mdash; evaluated inside DEVCON Luzon as a real
          learning community.
        </p>
        <ul className="nt-home__study-objectives">
          {OBJECTIVES_SHORT.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <button
          type="button"
          className="nt-home__study-cta"
          onClick={() => navigate('/docs')}
        >
          Read the full docs &rarr;
        </button>
      </div>
    </section>
  );
}
