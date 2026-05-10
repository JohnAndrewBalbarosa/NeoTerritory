import { useEffect } from 'react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';

// Per D40 (audience reframe), D41 (effects budget), D42 (info offloading),
// D43 (features-first hierarchy), and the doc blueprint at
// docs/Codebase/Frontend/src/components/marketing/HeroLanding.tsx.md.
//
// Surface-level only. Nothing on this page goes deeper than two sentences.
// Pattern names DO NOT appear in the Features grid. The page is a series of
// silent doors to the surfaces that own the depth.

interface FeatureTile {
  title: string;
  promise: string;
  glyph: string;
  surface: string;
}

const FEATURES: ReadonlyArray<FeatureTile> = [
  {
    title: 'Auto-documentation',
    promise:
      'Your code gets a README it didn’t have, generated from the pattern we detected.',
    glyph: '¶',
    surface: '/student-studio',
  },
  {
    title: 'Auto-integration tests',
    promise: 'We write the tests your reviewer expects. You ship.',
    glyph: '✓',
    surface: '/student-studio',
  },
  {
    title: 'Pattern detection',
    promise: 'We tell you which design pattern your AI used — even when you didn’t know.',
    glyph: '◇',
    surface: '/student-studio',
  },
  {
    title: 'Readability score',
    promise: 'See exactly which lines hurt the next reader. Fix them in one click.',
    glyph: '⚖',
    surface: '/student-studio',
  },
  {
    title: 'Sample library',
    promise: 'Stuck? Load a real-world sample for any pattern. Learn by example.',
    glyph: '◐',
    surface: '/student-studio',
  },
  {
    title: 'Run history',
    promise: 'Every analysis saved. Compare versions. Track your readability over time.',
    glyph: '⏱',
    surface: '/student-studio',
  },
];

interface BentoDoor {
  title: string;
  blurb: string;
  path: string;
  size: '1x1' | '2x1' | '1x2' | '2x2';
}

// Bento doors to the deeper surfaces. NEVER teach here — just invite.
const DOORS: ReadonlyArray<BentoDoor> = [
  {
    title: 'See how it works',
    blurb: 'Five stages from raw C++ to detected pattern. One page, deep.',
    path: '/mechanics',
    size: '2x1',
  },
  {
    title: 'Why this matters',
    blurb: 'Four industries where unreadable code costs more than missed deadlines.',
    path: '/why',
    size: '1x1',
  },
  {
    title: 'Pattern catalog',
    blurb: 'Every pattern we recognise, with intent, problem, solution.',
    path: '/patterns',
    size: '1x1',
  },
  {
    title: 'Take the tour',
    blurb: 'Eight steps through the studio. No sign-in.',
    path: '/tour',
    size: '1x1',
  },
  {
    title: 'Research',
    blurb: 'Books and prior art behind the algorithm.',
    path: '/research',
    size: '1x1',
  },
  {
    title: 'About this thesis',
    blurb: 'Research question, hypothesis, method, contribution.',
    path: '/about',
    size: '1x1',
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: ReadonlyArray<FaqItem> = [
  {
    q: 'Do I need to know design patterns already?',
    a: 'No. We tell you which pattern your code uses; you do not need to recognise it first.',
  },
  {
    q: 'Does it work on AI-written code?',
    a: 'Yes. That is the primary use case.',
  },
  {
    q: 'What language do I paste?',
    a: 'C++. Other languages are not supported in this iteration.',
  },
  {
    q: 'Do I have to sign in to read the site?',
    a: 'No. Sign-in is only required to save runs and use the studio.',
  },
  {
    q: 'Where does the documentation come from?',
    a: 'A pattern-aware AI layer with a deterministic fallback. You always get docs, even when AI is offline.',
  },
];

export default function HeroLanding() {
  // Hash-anchor support: nav can route to /#features. On mount and on every
  // hash change, scroll the matching anchor into view if present.
  useEffect(() => {
    function scrollToHash(): void {
      const h = window.location.hash;
      if (!h) return;
      const id = h.replace(/^#/, '');
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, []);

  return (
    <main className="nt-home" id="main">
      <section className="nt-home__above" aria-labelledby="home-heading">
        <p className="nt-home__eyebrow">Design pattern tutor</p>
        <h1 id="home-heading" className="nt-home__title">
          Design pattern tutor that auto-documents and auto-tests your code.
        </h1>
        <p className="nt-home__algo">
          Powered by our own lexical-tagging + parse-tree algorithm. Fast. Efficient.
        </p>

        <div className="nt-home__demo" aria-label="30-second product demo">
          {/*
            Demo embed slot. While the real recording is pending, we render
            a poster-only frame that gracefully replaces itself with a
            looping <video> when the file lands. Per D43.
          */}
          <video
            className="nt-home__demo-video"
            poster="/demo/landing-30s.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-label="A 30-second walkthrough of the studio: paste, analyze, get docs and tests"
          >
            <source src="/demo/landing-30s.webm" type="video/webm" />
          </video>
          <div className="nt-home__demo-fallback" aria-hidden="true">
            <p className="nt-home__demo-fallback-line">paste C++</p>
            <p className="nt-home__demo-fallback-line">→ detect pattern</p>
            <p className="nt-home__demo-fallback-line">→ docs + tests</p>
          </div>
        </div>

        <ol className="nt-home__steps">
          <li>
            <span className="nt-home__step-num">1</span>
            <span className="nt-home__step-text">Paste your C++ (or load a sample).</span>
          </li>
          <li>
            <span className="nt-home__step-num">2</span>
            <span className="nt-home__step-text">We detect the design pattern.</span>
          </li>
          <li>
            <span className="nt-home__step-num">3</span>
            <span className="nt-home__step-text">Get readable docs + integration tests, free.</span>
          </li>
        </ol>

        <div className="nt-home__primary-cta">
          <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
            Try it now
          </MagneticButton>
        </div>
      </section>

      <section className="nt-home__features" id="features" aria-labelledby="features-heading">
        <header className="nt-home__features-head">
          <p className="nt-section-eyebrow">Features</p>
          <h2 id="features-heading" className="nt-home__features-title">
            What you get.
          </h2>
        </header>
        <div className="nt-home__features-grid">
          {FEATURES.map((f) => (
            <button
              key={f.title}
              type="button"
              className="nt-home__feature"
              onClick={() => navigate(f.surface)}
            >
              <span className="nt-home__feature-glyph" aria-hidden="true">
                {f.glyph}
              </span>
              <h3 className="nt-home__feature-title">{f.title}</h3>
              <p className="nt-home__feature-promise">{f.promise}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="nt-home__bento" aria-labelledby="bento-heading">
        <header className="nt-home__bento-head">
          <p className="nt-section-eyebrow">More</p>
          <h2 id="bento-heading" className="nt-home__bento-title">
            Go deeper when you want.
          </h2>
        </header>
        <div className="nt-home__bento-grid">
          {DOORS.map((d) => (
            <button
              key={d.path}
              type="button"
              className="nt-home__door"
              data-size={d.size}
              onClick={() => navigate(d.path)}
            >
              <h3 className="nt-home__door-title">{d.title}</h3>
              <p className="nt-home__door-blurb">{d.blurb}</p>
              <span className="nt-home__door-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="nt-home__faq" aria-labelledby="faq-heading">
        <header className="nt-home__faq-head">
          <p className="nt-section-eyebrow">FAQ</p>
          <h2 id="faq-heading" className="nt-home__faq-title">
            Quick answers.
          </h2>
        </header>
        <dl className="nt-home__faq-list">
          {FAQ.map((item) => (
            <div key={item.q} className="nt-home__faq-row">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="nt-home__final-cta">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
