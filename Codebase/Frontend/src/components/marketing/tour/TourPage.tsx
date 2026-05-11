import { useEffect, useState } from 'react';
import { navigate } from '../../../logic/router';
import { TOUR_STEPS } from './tourSteps';

// Per Sprint 0 doc blueprint: public revisitable walkthrough. Same content
// source (tourSteps.ts) as the future in-studio popup walkthrough so they
// can never drift. No sign-in required.

export default function TourPage() {
  const [activeNum, setActiveNum] = useState<number>(1);

  useEffect(() => {
    const targets = TOUR_STEPS.map((s) =>
      document.getElementById(`tour-${s.slug}`),
    ).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const slug = id.replace(/^tour-/, '');
          const step = TOUR_STEPS.find((s) => s.slug === slug);
          if (step) setActiveNum(step.num);
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0.1, 0.4, 0.8] },
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className="nt-tour" id="main">
      <header className="nt-tour__head">
        <p className="nt-section-eyebrow">Tour</p>
        <h1 className="nt-tour__title">A walk through the studio.</h1>
        <p className="nt-tour__lede">
          No sign-in needed. Each step shows one thing the studio lets you do, in the order you
          will meet them.
        </p>
      </header>

      <div className="nt-tour__indicator" role="status">
        Step {activeNum} of {TOUR_STEPS.length}
      </div>

      <ol className="nt-tour__steps">
        {TOUR_STEPS.map((s) => (
          <li
            key={s.slug}
            id={`tour-${s.slug}`}
            className="nt-tour__step"
            data-active={activeNum === s.num}
          >
            <span className="nt-tour__num">{s.num.toString().padStart(2, '0')}</span>
            <h2 className="nt-tour__step-title">{s.title}</h2>
            <p className="nt-tour__step-text">{s.paragraph}</p>
            <p className="nt-tour__takeaway">
              <span aria-hidden="true">→ </span>
              {s.takeaway}
            </p>
            {s.imagePath ? (
              <img
                className="nt-tour__image"
                src={s.imagePath}
                alt={`Screenshot for step ${s.num}: ${s.title}`}
                loading="lazy"
              />
            ) : (
              <div className="nt-tour__placeholder" aria-hidden="true">
                Screenshot for &ldquo;{s.title}&rdquo;
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="nt-tour__cta">
        <button
          type="button"
          className="nt-tour__cta-btn"
          onClick={() => navigate('/student-studio')}
        >
          Try it now
        </button>
      </div>
    </main>
  );
}
