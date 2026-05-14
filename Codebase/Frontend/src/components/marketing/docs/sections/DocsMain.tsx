// Slim /docs main column. The page is a short overview, not a teacher.
// Deep teaching lives at /patterns/learn (the StudentLearningHub-style
// surface). Docs only orients the reader: what NeoTerritory does, the
// three pattern families it recognises, and a three-sentence summary
// of how analysis works.

import { FAMILIES } from '../../../../data/learningContent';
import { navigate } from '../../../../logic/router';

interface FamilyCard {
  id: string;
  name: string;
  blurb: string;
  patterns: ReadonlyArray<string>;
}

// Three family cards: Creational, Structural, Behavioural. Pattern
// names are pulled from learningContent.FAMILIES so this stays in sync
// with the lessons surface.
function familyCards(): ReadonlyArray<FamilyCard> {
  const order = ['creational', 'structural', 'behavioural'] as const;
  const blurbs: Record<string, string> = {
    creational: 'Patterns that decide how new objects are made.',
    structural: 'Patterns that decide how objects fit together.',
    behavioural: 'Patterns that decide how objects communicate.',
  };
  const cards: FamilyCard[] = [];
  for (const id of order) {
    const fam = FAMILIES.find((f) => f.id === id);
    if (!fam) continue;
    cards.push({
      id: fam.id,
      name: fam.name,
      blurb: blurbs[id] ?? fam.gist,
      patterns: fam.lessons.map((l) => l.name),
    });
  }
  return cards;
}

export default function DocsMain() {
  const cards = familyCards();

  return (
    <div className="nt-docs__main">
      <section id="dp-overview" aria-labelledby="dp-overview-h" className="nt-docs__overview">
        <p className="nt-section-eyebrow">Overview</p>
        <h2 id="dp-overview-h" className="nt-docs__section-title">
          What NeoTerritory does
        </h2>
        <p>
          NeoTerritory analyzes C++ source for design patterns (Creational, Structural,
          Behavioral) and helps you learn how they're recognized. Start a run in the
          Studio, walk through the analysis, then verify your understanding with a
          self-check.
        </p>
      </section>

      <section id="dp-families" aria-labelledby="dp-families-h" className="nt-docs__families">
        <p className="nt-section-eyebrow">Pattern families</p>
        <h2 id="dp-families-h" className="nt-docs__section-title">
          Three families we recognise
        </h2>
        <p className="nt-docs__families-note">
          Opening a family takes you to the Student Learning surface. You&rsquo;ll need to sign in
          with your Google account first to track progress on this device.
        </p>
        <div className="nt-docs__family-grid">
          {cards.map((c) => (
            <article key={c.id} className="nt-docs__family-card">
              <h3 className="nt-docs__family-name">{c.name}</h3>
              <p className="nt-docs__family-blurb">{c.blurb}</p>
              <ul className="nt-docs__family-list">
                {c.patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <button
                type="button"
                className="nt-docs__family-cta"
                onClick={() => navigate('/patterns/learn')}
              >
                Learn this family →
              </button>
            </article>
          ))}
        </div>
      </section>

      <section id="dp-how" aria-labelledby="dp-how-h" className="nt-docs__how">
        <p className="nt-section-eyebrow">How it works</p>
        <h2 id="dp-how-h" className="nt-docs__section-title">
          How analysis works
        </h2>
        <p>
          Source is tokenized and each class is scored against pattern rules. When two
          patterns share enough structure to be ambiguous, we surface both for you to
          inspect. A self-check at the end records whether each pattern decision matched
          your intent.
        </p>
      </section>
    </div>
  );
}
