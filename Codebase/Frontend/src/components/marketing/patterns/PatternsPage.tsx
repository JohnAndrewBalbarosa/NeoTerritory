import { navigate } from '../../../logic/router';
import { PATTERNS } from './patternData';

// Per D59 (this turn): the All/GoF filter is removed. Our focus is GoF, so
// the catalog below IS the patterns we cover. Method Chaining, Repository,
// and PIMPL are non-GoF but they are first-class members of OUR detection
// catalog (per the CodiNeo thesis Chapter 1.1 + 1.7), so they stay listed.
// The page is a single directory grouped by family.

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
          Reference + lessons. One tile per pattern. Click a tile to read the lesson and see how
          NeoTerritory detects it.
        </p>
      </header>

      {grouped.map((group) => (
        <section key={group.family} className="nt-patterns__group" aria-label={group.family}>
          <h2 className="nt-patterns__family">{group.family}</h2>
          <div className="nt-patterns__grid">
            {group.items.map((p) => (
              <button
                key={p.slug}
                type="button"
                className="nt-patterns__tile"
                onClick={() => navigate(`/patterns/${p.slug}`)}
              >
                <span className="nt-patterns__tile-name">{p.name}</span>
                <span className="nt-patterns__tile-intent">{p.intent}</span>
                <span className="nt-patterns__tile-badge">
                  {p.catalogFile ? 'Detects from JSON' : 'Reference only'}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
