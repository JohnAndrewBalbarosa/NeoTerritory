import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import TryItChooser from './TryItChooser';
import ScrollReveal from './effects/ScrollReveal';
import HomeStudySummary from './sections/HomeStudySummary';

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

type BentoSize = '1x1' | '2x1' | '1x2' | '2x2' | '3x1';

interface BentoDoor {
  title: string;
  blurb: string;
  path: string;
  size: BentoSize;
}

// The bento grid renders 3 columns at desktop. To guarantee the doors
// always form a clean rectangle (no missing cells), the first tile
// expands based on count % 3:
//   - remainder 0 → all 1x1, perfect 3-col rectangle (e.g. count=6 → 3x2).
//   - remainder 1 → first tile spans 3 cols (full row), rest 1x1
//                   (e.g. count=4 → row of 3 + row of 3 = 2 rows).
//   - remainder 2 → first tile spans 2 cols, rest 1x1
//                   (e.g. count=5 → first row 2+1+1+1 ... actually 2+1 then 1+1+1 = 2 rows of 3).
// Author-specified sizes on tile 0 are overridden by this rule; sizes
// on other tiles are preserved so feature-tiles can still vary if needed.
function packFirstTileSize(index: number, count: number, baseSize: BentoSize): BentoSize {
  if (index !== 0) return baseSize;
  const remainder = count % 3;
  if (remainder === 1) return '3x1';
  if (remainder === 2) return '2x1';
  return '1x1';
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
    title: 'Docs',
    blurb: 'Methods, design rationale, trade-offs, and references.',
    path: '/docs',
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
            <title>Three-step pipeline: paste C++, detect pattern, generate docs and tests</title>
            <rect width="960" height="280" fill="#0a0f1c" rx="16"/>
            <rect x="40" y="80" width="220" height="120" rx="12" fill="#0f1b2e" stroke="#00d1d8" strokeWidth="1.5" strokeOpacity="0.5"/>
            <text x="150" y="128" textAnchor="middle" fill="#e2e4f0" fontSize="14" fontFamily="monospace">Paste C++</text>
            <text x="150" y="150" textAnchor="middle" fill="#9aa3b0" fontSize="11" fontFamily="monospace">source code</text>
            <path d="M260 140 L340 140" stroke="#00d1d8" strokeWidth="2" markerEnd="url(#arr)" strokeOpacity="0.8"/>
            <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#00d1d8"/></marker></defs>
            <rect x="340" y="80" width="280" height="120" rx="12" fill="#0f1b2e" stroke="#78b815" strokeWidth="1.5" strokeOpacity="0.5"/>
            <text x="480" y="128" textAnchor="middle" fill="#e2e4f0" fontSize="14" fontFamily="monospace">Detect pattern</text>
            <text x="480" y="150" textAnchor="middle" fill="#9aa3b0" fontSize="11" fontFamily="monospace">lexical + parse-tree algorithm</text>
            <path d="M620 140 L700 140" stroke="#78b815" strokeWidth="2" markerEnd="url(#arr2)" strokeOpacity="0.8"/>
            <defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#78b815"/></marker></defs>
            <rect x="700" y="80" width="220" height="120" rx="12" fill="#0f1b2e" stroke="#9b59f5" strokeWidth="1.5" strokeOpacity="0.5"/>
            <text x="810" y="120" textAnchor="middle" fill="#e2e4f0" fontSize="14" fontFamily="monospace">Generate docs</text>
            <text x="810" y="142" textAnchor="middle" fill="#9aa3b0" fontSize="11" fontFamily="monospace">+ tests</text>
            <text x="810" y="164" textAnchor="middle" fill="#9b59f5" fontSize="11" fontFamily="monospace">pattern-aware AI</text>
          </svg>
        </figure>

        <div className="nt-home__above-ctas">
          <MagneticButton
            variant="primary"
            onClick={() => setChooserOpen(true)}
            ariaLabel="Try CodiNeo now"
          >
            Try it now
          </MagneticButton>
          <MagneticButton
            variant="ghost"
            onClick={() => navigate('/mechanics')}
            ariaLabel="See how CodiNeo works"
          >
            See how it works
          </MagneticButton>
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
      </ScrollReveal>

      <HomeStudySummary />

      <section className="nt-home__bento" aria-labelledby="bento-heading">
        <header className="nt-home__bento-head">
          <p className="nt-section-eyebrow">More</p>
          <h2 id="bento-heading" className="nt-home__bento-title">
            Go deeper when you want.
          </h2>
        </header>
        <div className="nt-home__bento-grid">
          {DOORS.map((d, i) => (
            <button
              key={d.path}
              type="button"
              className="nt-home__door"
              data-size={packFirstTileSize(i, DOORS.length, d.size)}
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
