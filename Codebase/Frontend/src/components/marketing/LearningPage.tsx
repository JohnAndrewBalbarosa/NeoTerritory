import { useEffect } from 'react';
import { navigate } from '../../logic/router';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import { FAMILIES } from '../../data/learningContent';

// The /learn surface on the marketing site is intentionally a single
// overview page. There are no per-family or per-lesson links here — the
// full learning path lives behind a session seat in the Student Learning
// Hub. A single referral CTA sits between the marketing nav and the body
// to send the reader there. Keeping the overview link-free prevents the
// homepage from becoming a partial duplicate of the gated course.
export default function LearningPage() {
  useOverflowGuard({ rootSelector: '.nt-learn', tolerancePx: 2 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  return (
    <main className="nt-learn nt-learn--overview" id="main">
      <section className="nt-learn-referral" aria-label="Continue to student learning">
        <div className="nt-learn-referral__inner">
          <div className="nt-learn-referral__copy">
            <p className="nt-learn-referral__eyebrow">Want the full path?</p>
            <p className="nt-learn-referral__lede">
              The Learn tab is an overview. The lessons, the practice samples, and the live
              analyzer live behind a session seat.
            </p>
          </div>
          <div className="nt-learn-referral__actions">
            <MagneticButton
              variant="primary"
              onClick={() => navigate('/choose')}
              ariaLabel="Open the full student learning path"
            >
              Open the full student learning path
            </MagneticButton>
            <p className="nt-learn-referral__hint">
              You will be asked to log in or claim a session seat first.
            </p>
          </div>
        </div>
      </section>

      <section className="nt-learn__hero" aria-labelledby="learn-heading">
        <p className="nt-section-eyebrow">Design pattern lessons</p>
        <h1 id="learn-heading" className="nt-learn__title">
          <SplitText text="Learn the shapes." as="span" />
        </h1>
        <p className="nt-learn__lede">
          A design pattern is a name for a shape that shows up again and again in code. NeoTerritory
          teaches the structural rule each pattern obeys, not the names developers happen to give
          their methods. The student path walks through the concepts first, then introduces each
          pattern with the exact token combos the analyzer looks for.
        </p>
      </section>

      <ScrollReveal as="section" className="nt-family-grid-section" aria-label="Pattern families">
        <div className="nt-family-grid">
          {FAMILIES.map((f, idx) => (
            <ScrollReveal as="article" key={f.id} className="nt-family-card" delay={idx * 0.06}>
              <p className="nt-family-card__num">{(idx + 1).toString().padStart(2, '0')}</p>
              <h2 className="nt-family-card__name">{f.name}</h2>
              <p className="nt-family-card__gist">{f.gist}</p>
              <p className="nt-family-card__count">
                {f.lessons.length} {f.lessons.length === 1 ? 'lesson' : 'lessons'} in the student
                path
              </p>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <section className="nt-learn-overview-note" aria-label="What the student path covers">
        <h2 className="nt-learn-overview-note__h">What the student path adds beyond this overview</h2>
        <ul className="nt-learn-overview-note__list">
          <li>The concept module — including ambiguity and the connotative-definition rule.</li>
          <li>One lesson per pattern with the exact token combos the analyzer enforces.</li>
          <li>A practice step that opens real C++ samples in the analyzer.</li>
          <li>Closing notes on how patterns vary by company and how unit testing pins them down.</li>
        </ul>
      </section>
    </main>
  );
}
