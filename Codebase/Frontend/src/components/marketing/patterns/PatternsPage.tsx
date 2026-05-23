import { navigate } from '../../../logic/router';
import { PATTERNS } from './patternData';
import { useFeatureReleases } from '../../../hooks/useFeatureReleases';

// Per this turn (post-D74 refresh):
//   1. Drop the standalone "Tokens" popover. The token criteria already
//      live inline on the per-pattern detail page under "Correct structure,"
//      so the popover was duplicate UX. Tile click now goes straight to
//      the detail page — one surface, no split popups.
//   2. Add a "Why GoF" subsection under the existing "Source & framing"
//      block so the catalog explains why it is anchored on Gamma et al.
//      1994 + Nesteruk 2022, not just paraphrased from a single book.

const FAMILY_ORDER: ReadonlyArray<string> = [
  'Creational',
  'Structural',
  'Behavioural',
  'Idioms',
];

export default function PatternsPage() {
  const { isReleased } = useFeatureReleases();
  const learnCtaVisible = isReleased('patterns-learn-cta') && isReleased('student-learning');

  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: PATTERNS.filter((p) => p.family === family),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="nt-patterns" id="main" data-testid="patterns-family-grid">
      <header className="nt-patterns__head">
        <div className="nt-patterns__head-text">
          <p className="nt-section-eyebrow">Pattern catalog</p>
          <h1 className="nt-patterns__title">Patterns CodiNeo recognises</h1>
          <p className="nt-patterns__lede">
            Reference + invite. One tile per pattern. Click a tile to open the detail page, which
            carries the structural criteria, the must-have tokens, and the per-pattern citations.
          </p>
        </div>
        {/* D77: 'Learn more' button top-right of the main content header.
            Routes to /patterns/learn — the step-through learning hub that
            owns the student-learning content under the Patterns surface.
            Gated on the `patterns-learn-cta` + `student-learning` feature
            flags so the developer admin can hide it pre-release. */}
        {learnCtaVisible && (
          <button
            type="button"
            className="nt-patterns__head-cta"
            onClick={() => navigate('/patterns/learn')}
          >
            Learn more →
          </button>
        )}
      </header>

      {/* The "Source & framing" and "Why GoF" reference sections moved to
          the bottom of the Learning Path page (/patterns/learn) so the
          citation/context lives in one place alongside the lessons. */}

      {grouped.map((group) => (
        <section key={group.family} className="nt-patterns__group" aria-label={group.family}>
          <h2 className="nt-patterns__family">{group.family}</h2>
          <div className="nt-patterns__grid">
            {group.items.map((p) => (
              <article key={p.slug} className="nt-patterns__tile-wrap">
                <button
                  type="button"
                  className="nt-patterns__tile"
                  onClick={() => navigate(`/patterns/${p.slug}`)}
                >
                  <span className="nt-patterns__tile-name">{p.name}</span>
                  <span className="nt-patterns__tile-intent">{p.intent}</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
