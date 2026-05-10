import { useEffect, useState } from 'react';
import { navigate, patternSlugFromPath } from '../../../logic/router';
import { findPattern } from './patternData';

// Per Sprint 0 doc blueprint: detail page renders Intent / Problem / Solution
// / Code sketch / Detection / Sample (when present). Each detail page stands
// alone — no links to other detail pages. Returning to the index uses a
// single "Back to catalog" button.

export default function PatternDetailPage() {
  const [slug, setSlug] = useState<string>(() =>
    typeof window !== 'undefined' ? patternSlugFromPath(window.location.pathname) : '',
  );

  useEffect(() => {
    function handleNav(): void {
      setSlug(patternSlugFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', handleNav);
    window.addEventListener('nt:navigate', handleNav);
    return () => {
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('nt:navigate', handleNav);
    };
  }, []);

  const pattern = findPattern(slug);

  if (!pattern) {
    return (
      <main className="nt-patterns nt-patterns--missing" id="main">
        <header className="nt-patterns__head">
          <p className="nt-section-eyebrow">Pattern not found</p>
          <h1 className="nt-patterns__title">No pattern at &ldquo;{slug || '(empty)'}&rdquo;</h1>
          <p className="nt-patterns__lede">
            That slug is not in the catalog. Use the directory to find what you are looking for.
          </p>
        </header>
        <button
          type="button"
          className="nt-patterns__back"
          onClick={() => navigate('/patterns')}
        >
          ← Back to catalog
        </button>
      </main>
    );
  }

  return (
    <main className="nt-pattern-detail" id="main">
      <header className="nt-pattern-detail__head">
        <p className="nt-section-eyebrow">{pattern.family} pattern</p>
        <h1 className="nt-pattern-detail__title">{pattern.name}</h1>
        <p className="nt-pattern-detail__intent">{pattern.intent}</p>
      </header>

      <section className="nt-pattern-detail__section">
        <h2>Problem</h2>
        <p>{pattern.problem}</p>
      </section>

      <section className="nt-pattern-detail__section">
        <h2>Solution</h2>
        <p>{pattern.solution}</p>
        <pre className="nt-pattern-detail__code" aria-label="Code sketch">
          {pattern.codeSketch}
        </pre>
      </section>

      <section className="nt-pattern-detail__section">
        <h2>Where NeoTerritory detects this</h2>
        <p>{pattern.detection}</p>
        {pattern.catalogFile ? (
          <p className="nt-pattern-detail__catalog">
            Catalog file: <code>{pattern.catalogFile}</code>
          </p>
        ) : (
          <p className="nt-pattern-detail__catalog nt-pattern-detail__catalog--reference">
            Catalog entry not yet shipped — this pattern is reference-only.
          </p>
        )}
      </section>

      <button
        type="button"
        className="nt-patterns__back"
        onClick={() => navigate('/patterns')}
      >
        ← Back to catalog
      </button>
    </main>
  );
}
