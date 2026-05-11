import { useEffect, useState } from 'react';
import { navigate, patternSlugFromPath } from '../../../logic/router';
import { findPattern, PATTERN_BOOK_CITATION, type PatternSource } from './patternData';

function formatSource(s: PatternSource): string {
  const chapter = s.chapter ? ` — ${s.chapter}` : '';
  return `${s.citation}${chapter}`;
}

// Per Sprint 0 doc blueprint plus this turn's merge of learning content
// from learningContent.ts: sections render in fixed order:
//   1. Intent
//   2. One-liner + What it is + When to use + Everyday example  (lesson)
//   3. Problem
//   4. Solution + code sketch
//   5. Where NeoTerritory detects this
//   6. Prerequisites + correctStructure  (lesson; from learningContent.ts)
//   7. Source citation (Nesteruk 2022 chapter)

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

  const hasLessonStub = !!(pattern.oneLiner || pattern.whatItIs || pattern.whenToUse);

  return (
    <main className="nt-pattern-detail" id="main">
      <header className="nt-pattern-detail__head">
        <p className="nt-section-eyebrow">{pattern.family} pattern</p>
        <h1 className="nt-pattern-detail__title">{pattern.name}</h1>
        <p className="nt-pattern-detail__intent">{pattern.intent}</p>
        {pattern.oneLiner ? (
          <p className="nt-pattern-detail__oneliner">→ {pattern.oneLiner}</p>
        ) : null}
      </header>

      {hasLessonStub ? (
        <section className="nt-pattern-detail__section nt-pattern-detail__lesson">
          <h2>Learn it</h2>
          {pattern.whatItIs ? (
            <div className="nt-pattern-detail__lesson-row">
              <h3>What it is</h3>
              <p>{pattern.whatItIs}</p>
            </div>
          ) : null}
          {pattern.whenToUse ? (
            <div className="nt-pattern-detail__lesson-row">
              <h3>When to use it</h3>
              <p>{pattern.whenToUse}</p>
            </div>
          ) : null}
          {pattern.everydayExample ? (
            <div className="nt-pattern-detail__lesson-row">
              <h3>Everyday example</h3>
              <p>{pattern.everydayExample}</p>
            </div>
          ) : null}
        </section>
      ) : null}

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
        {pattern.readabilityBenefit ? (
          <p className="nt-pattern-detail__readability">
            <strong>Readability benefit:</strong> {pattern.readabilityBenefit}
          </p>
        ) : null}
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

      {pattern.prerequisites && pattern.prerequisites.length > 0 ? (
        <section className="nt-pattern-detail__section">
          <h2>Prerequisites</h2>
          <ul className="nt-pattern-detail__prereqs">
            {pattern.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {pattern.correctStructure ? (
        <section className="nt-pattern-detail__section">
          <h2>Correct structure (what the analyzer enforces)</h2>
          <h3 className="nt-pattern-detail__rule-head">Must have</h3>
          <ul className="nt-pattern-detail__rules">
            {pattern.correctStructure.mustHave.map((r) => (
              <li key={r.label} className="nt-pattern-detail__rule">
                <p className="nt-pattern-detail__rule-label">{r.label}</p>
                <code className="nt-pattern-detail__rule-tokens">{r.tokens.join(' ')}</code>
                <p className="nt-pattern-detail__rule-why">{r.why}</p>
              </li>
            ))}
          </ul>
          {pattern.correctStructure.mustNotHave &&
          pattern.correctStructure.mustNotHave.length > 0 ? (
            <>
              <h3 className="nt-pattern-detail__rule-head">Must NOT have</h3>
              <ul className="nt-pattern-detail__rules">
                {pattern.correctStructure.mustNotHave.map((r) => (
                  <li key={r.label} className="nt-pattern-detail__rule">
                    <p className="nt-pattern-detail__rule-label">{r.label}</p>
                    <code className="nt-pattern-detail__rule-tokens">{r.tokens.join(' ')}</code>
                    <p className="nt-pattern-detail__rule-why">{r.why}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <p className="nt-pattern-detail__rule-why-it-works">
            <strong>Why it works:</strong> {pattern.correctStructure.whyItWorks}
          </p>
        </section>
      ) : null}

      {(() => {
        const sources = pattern.sources && pattern.sources.length > 0
          ? pattern.sources
          : ([{ kind: 'book', citation: PATTERN_BOOK_CITATION, chapter: pattern.nesterukChapter }] as ReadonlyArray<PatternSource>);

        const isOnlyGlobalBook =
          sources.length === 1 &&
          sources[0].citation === PATTERN_BOOK_CITATION &&
          !sources[0].chapter;

        return (
          <section className="nt-pattern-detail__section nt-pattern-detail__cite">
            <h2>Sources</h2>
            {isOnlyGlobalBook ? (
              <p className="nt-pattern-detail__cite-book">{PATTERN_BOOK_CITATION}</p>
            ) : (
              <ol className="nt-pattern-detail__sources">
                {sources.map((s, i) => (
                  <li key={`${s.citation}-${i}`} className="nt-pattern-detail__source">
                    <span className="nt-pattern-detail__source-kind">[{s.kind}]</span>{' '}
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {formatSource(s)}
                      </a>
                    ) : (
                      formatSource(s)
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })()}

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
