import { navigate } from '../../../logic/router';
import { PATTERNS, PATTERN_BOOK_CITATION, WHY_GOF_EXPLAINER } from './patternData';

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
  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: PATTERNS.filter((p) => p.family === family),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="nt-patterns" id="main">
      <header className="nt-patterns__head">
        <p className="nt-section-eyebrow">Pattern catalog</p>
        <h1 className="nt-patterns__title">Patterns NeoTerritory recognises</h1>
        <p className="nt-patterns__lede">
          Reference + invite. One tile per pattern. Click a tile to open the detail page, which
          carries the structural criteria, the must-have tokens, and the per-pattern citations.
        </p>
      </header>

      <section className="nt-patterns__source" aria-labelledby="patterns-source">
        <p className="nt-section-eyebrow">Source &amp; framing</p>
        <h2 id="patterns-source" className="nt-patterns__source-title">
          Definitions come from Nesteruk 2022 and Gamma et al. 1994
        </h2>
        <p className="nt-patterns__source-body">
          The intent, problem, solution, and idiomatic implementation for every pattern below are
          paraphrased from {PATTERN_BOOK_CITATION} and cross-checked against the original Gang of
          Four reference. Every pattern detail page lists its sources explicitly.
        </p>
        <p className="nt-patterns__source-body">
          Nesteruk&rsquo;s framing is straightforward: a design pattern is a named, idiomatic
          arrangement of classes and operations that solves a recurring object-oriented design
          problem. The same problem keeps appearing because the underlying language facts
          (inheritance, ownership, virtual dispatch) keep producing the same shapes. Giving each
          shape a name turns a paragraph of structural explanation into one word a reviewer can
          look up. That is the entire pitch of design patterns - shared vocabulary that compresses
          architecture into a few familiar shapes.
        </p>
      </section>

      <section className="nt-patterns__source" aria-labelledby="patterns-why-gof">
        <p className="nt-section-eyebrow">Why GoF</p>
        <h2 id="patterns-why-gof" className="nt-patterns__source-title">
          Why the catalog is Gang-of-Four anchored
        </h2>
        <p className="nt-patterns__source-body">{WHY_GOF_EXPLAINER}</p>
      </section>

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
