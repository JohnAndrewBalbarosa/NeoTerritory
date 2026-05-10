import { useEffect, useState } from 'react';
import { navigate } from '../../../logic/router';
import { PATTERNS } from './patternData';

// Per Sprint 0 doc blueprint: PatternsPage is a directory, not a teaching
// surface. Bento grid grouped by family. Click a tile -> /patterns/<slug>.
// /patterns and /patterns/gof both render this index; gof filters out Idioms.

const FAMILY_ORDER: ReadonlyArray<string> = [
  'Creational',
  'Structural',
  'Behavioural',
  'Idioms',
];

export default function PatternsPage() {
  const [gofOnly, setGofOnly] = useState<boolean>(
    typeof window !== 'undefined' && window.location.pathname === '/patterns/gof',
  );

  useEffect(() => {
    function handleNav(): void {
      setGofOnly(window.location.pathname === '/patterns/gof');
    }
    window.addEventListener('popstate', handleNav);
    window.addEventListener('nt:navigate', handleNav);
    return () => {
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('nt:navigate', handleNav);
    };
  }, []);

  const visible = gofOnly ? PATTERNS.filter((p) => p.family !== 'Idioms') : PATTERNS;

  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: visible.filter((p) => p.family === family),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="nt-patterns" id="main">
      <header className="nt-patterns__head">
        <p className="nt-section-eyebrow">Pattern catalog</p>
        <h1 className="nt-patterns__title">
          {gofOnly ? 'GoF patterns' : 'Patterns NeoTerritory recognises'}
        </h1>
        <p className="nt-patterns__lede">
          Reference directory. One tile per pattern. Click a tile to see how NeoTerritory detects
          it.
        </p>
        <nav className="nt-patterns__filters" aria-label="Pattern filter">
          <button
            type="button"
            data-active={!gofOnly}
            onClick={() => navigate('/patterns')}
          >
            All
          </button>
          <button
            type="button"
            data-active={gofOnly}
            onClick={() => navigate('/patterns/gof')}
          >
            GoF only
          </button>
        </nav>
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
