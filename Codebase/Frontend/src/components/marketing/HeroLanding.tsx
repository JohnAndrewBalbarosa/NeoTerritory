import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import TryItChooser from './TryItChooser';

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
    title: 'See possible patterns',
    text: 'CodiNeo checks whether your code looks like a known design pattern.',
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

const SIMPLE_WORKFLOW = [
  {
    title: 'Paste C++ code',
    text: 'Start by adding a C++ snippet or file.',
  },
  {
    title: 'See possible pattern matches',
    text: 'CodiNeo checks your code and looks for pattern-like structures.',
  },
  {
    title: 'Learn from the result',
    text: 'You can review the detected pattern, the related code parts, and the explanation.',
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
  // Try-it chooser: clicking the primary CTA opens this instead of routing
  // straight to the gated studio. Picking "Learning" goes to the open
  // /student-learning surface; picking "Studio" goes to /student-studio
  // where sign-in is triggered.
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);

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
    <>
    <TryItChooser open={chooserOpen} onClose={() => setChooserOpen(false)} />
    <main className="nt-home" id="main">
      <section className="nt-home__above" aria-labelledby="home-heading">
        <p className="nt-home__eyebrow">Design pattern tutor</p>
        <h1 id="home-heading" className="nt-home__title">
          Design pattern tutor that auto-documents and auto-tests your code.
        </h1>
        <p className="nt-home__algo">
          Powered by our own lexical-tagging + parse-tree algorithm. Fast. Efficient.
        </p>

        {/*
          Per D60 (this turn): the previous <video> slot referenced
          /demo/landing-30s.webm and /demo/landing-30s.jpg, neither of which
          exist. The result was a blank rectangle. Replaced with an inline
          SVG flow diagram that shows the three-step pipeline crisply at any
          size without any external file dependency.
        */}
        <figure
          className="nt-home__demo"
          aria-label="Three-step pipeline: paste C++, detect pattern, generate docs and tests"
        >
          <svg
            className="nt-home__demo-svg"
            viewBox="0 0 960 280"
            role="img"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            Learn design patterns with real C++ code
          </motion.p>
          <h1 id="hero-heading" className="nt-hero__title">
            <SplitText text="See the pattern." as="span" className="nt-hero__title-row" />
            <SplitText
              text="Understand the code."
              as="span"
              className="nt-hero__title-row nt-hero__title-row--accent"
              delay={0.35}
            />
          </h1>
          <motion.p
            className="nt-hero__lede"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            CodiNeo helps beginners learn design patterns by checking C++ code, showing
            possible pattern matches, and explaining them in a simpler way.
          </motion.p>
          <motion.div
            className="nt-hero__ctas"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <MagneticButton
              variant="primary"
              onClick={() => navigate('/choose')}
              ariaLabel="Open the analysis studio"
            >
              Open studio
            </MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => navigate('/learn')}
              ariaLabel="See how CodiNeo works"
            >
              See how it works
            </MagneticButton>
          </motion.div>
          <motion.dl
            className="nt-hero__stats"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            <div>
              <dt>Paste</dt>
              <dd>your C++ code</dd>
            </div>
            <div>
              <dt>Find</dt>
              <dd>possible patterns</dd>
            </div>
            <div>
              <dt>Learn</dt>
              <dd>what they mean</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <ScrollReveal as="section" className="nt-hero__concept">
        <div className="nt-concept-card">
          <header className="nt-section-head">
            <p className="nt-section-eyebrow">Start here</p>
            <h2 className="nt-section-title">What is a design pattern?</h2>
          </header>
          <div className="nt-concept-copy">
            <p>
              A design pattern is a common way of solving a programming problem. It is like a
              reusable idea or structure that developers use when building software.
            </p>
            <p>
              For example, some patterns help create objects, some help connect classes, and some
              help control how objects work together.
            </p>
            <p>
              CodiNeo helps you see these patterns in real C++ code so they are easier to
              understand.
            </p>
          </div>
          <div className="nt-mini-chips" aria-label="Design pattern examples">
            <span>Creating objects</span>
            <span>Connecting classes</span>
            <span>Organizing behavior</span>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__workflow">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Learning helper</p>
          <h2 className="nt-section-title">How CodiNeo helps you learn</h2>
          <p className="nt-section-lede">
            Instead of only reading definitions, you can connect patterns to actual code.
          </p>
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
        <MagneticButton variant="primary" onClick={() => navigate('/choose')}>
          Try it now
        </MagneticButton>
      </section>
    </main>
    </>
  );
}
