import { useEffect, useState } from 'react';
import { navigate } from '../../../logic/router';
import { PATTERNS, PATTERN_BOOK_CITATION, findPattern } from './patternData';

// Per D74 (this turn):
//   1. Add a top citation/idea section that names the reference book + the
//      author's general framing of design patterns. Isolated to /patterns
//      (no mention of /learn, /mechanics, etc).
//   2. Drop the "Detects from JSON" / "Reference only" tile badge. The
//      JSON-driven detection is standard practice and doesn't earn a label.
//      Replace with a small "Tokens" button that pops a surface-level
//      criteria preview. Deep coverage lives on the per-pattern detail
//      page; /patterns is reference + invite, not teaching.

const FAMILY_ORDER: ReadonlyArray<string> = [
  'Creational',
  'Structural',
  'Behavioural',
  'Idioms',
];

interface TokenPopoverProps {
  slug: string;
  onClose: () => void;
}

function TokenPopover({ slug, onClose }: TokenPopoverProps) {
  const pattern = findPattern(slug);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!pattern) return null;

  const cs = pattern.correctStructure;

  return (
    <div className="nt-patterns__pop" role="dialog" aria-modal="true" aria-labelledby="pop-title">
      <div className="nt-patterns__pop-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="nt-patterns__pop-panel" role="document">
        <header className="nt-patterns__pop-head">
          <p className="nt-patterns__pop-eyebrow">Tokens &amp; criteria</p>
          <h3 id="pop-title" className="nt-patterns__pop-title">
            {pattern.name}
          </h3>
          <button
            type="button"
            className="nt-patterns__pop-close"
            onClick={onClose}
            aria-label="Close criteria preview"
          >
            ×
          </button>
        </header>
        <div className="nt-patterns__pop-body">
          {cs && cs.mustHave.length > 0 ? (
            <>
              <p className="nt-patterns__pop-section-label">Must have</p>
              <ul className="nt-patterns__pop-rules">
                {cs.mustHave.slice(0, 3).map((r) => (
                  <li key={r.label}>
                    <code className="nt-patterns__pop-tokens">{r.tokens.join(' ')}</code>
                    <span className="nt-patterns__pop-rule-label">{r.label}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="nt-patterns__pop-empty">
              Surface criteria not authored yet. Open the detail page for the structural rule.
            </p>
          )}
        </div>
        <footer className="nt-patterns__pop-foot">
          <button
            type="button"
            className="nt-patterns__pop-cta"
            onClick={() => {
              onClose();
              navigate(`/patterns/${pattern.slug}`);
            }}
          >
            Open detail page &rarr;
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function PatternsPage() {
  const [popoverSlug, setPopoverSlug] = useState<string | null>(null);

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
          Reference + invite. One tile per pattern. Click a tile to open the detail page; click
          &ldquo;Tokens&rdquo; for a surface-level peek at what NeoTerritory looks for.
        </p>
      </header>

      <section className="nt-patterns__source" aria-labelledby="patterns-source">
        <p className="nt-section-eyebrow">Source &amp; framing</p>
        <h2 id="patterns-source" className="nt-patterns__source-title">
          Definitions come from Nesteruk 2022
        </h2>
        <p className="nt-patterns__source-body">
          The intent, problem, solution, and idiomatic implementation for every pattern below are
          paraphrased from {PATTERN_BOOK_CITATION}.
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
                <button
                  type="button"
                  className="nt-patterns__tile-tokens"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopoverSlug(p.slug);
                  }}
                  aria-label={`See token criteria for ${p.name}`}
                >
                  Tokens
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}

      {popoverSlug ? (
        <TokenPopover slug={popoverSlug} onClose={() => setPopoverSlug(null)} />
      ) : null}
    </main>
  );
}
