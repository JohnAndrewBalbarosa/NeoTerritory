import { useEffect } from 'react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import { dispatchTryItChooserOpen } from './TryItChooser';

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
    title: 'Pattern catalog',
    blurb: 'Every pattern we recognise, with intent, problem, solution.',
    path: '/patterns',
    size: '1x1',
  },
  {
    title: 'Take the tour',
    blurb: 'Seven steps through the studio. No sign-in.',
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
    title: 'About',
    blurb: 'What CodiNeo is and who it is for.',
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
  // D76: the TryItChooser modal is now hoisted to MarketingShell and opened
  // via the TRY_IT_OPEN_EVENT custom event. HeroLanding (and MarketingNav,
  // WhyPage, TourPage) all call dispatchTryItChooserOpen() instead of
  // owning local chooser state. Single source of truth, same modal across
  // every "Try it now" / "Try it" CTA.

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
            <defs>
              <linearGradient id="ntdemoFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="rgba(0, 209, 216, 0.18)" />
                <stop offset="100%" stopColor="rgba(123, 94, 167, 0.14)" />
              </linearGradient>
              <linearGradient id="ntdemoAccent" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgb(166, 255, 0)" />
                <stop offset="100%" stopColor="rgb(0, 209, 216)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="960" height="280" fill="url(#ntdemoFill)" rx="22" />

            {/* Step 1: Paste C++ — a tile with code lines */}
            <g transform="translate(40, 50)">
              <rect x="0" y="0" width="240" height="180" rx="14" fill="rgba(13,20,34,0.72)" stroke="rgba(0,209,216,0.32)" />
              <text x="20" y="30" fill="rgba(0,209,216,1)" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.12em">STEP 01</text>
              <text x="20" y="56" fill="#fff" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700">Paste C++</text>
              <g fontFamily="JetBrains Mono, monospace" fontSize="11" fill="rgba(226,228,240,0.78)">
                <text x="20" y="90">class Logger {'{'}</text>
                <text x="32" y="108">Logger() = default;</text>
                <text x="32" y="126">static Logger&amp;</text>
                <text x="32" y="144">instance();</text>
                <text x="20" y="162">{'}'};</text>
              </g>
            </g>

            {/* Arrow 1 */}
            <g transform="translate(290, 130)">
              <line x1="0" y1="10" x2="60" y2="10" stroke="url(#ntdemoAccent)" strokeWidth="3" />
              <polygon points="60,2 76,10 60,18" fill="rgb(0,209,216)" />
            </g>

            {/* Step 2: Detect pattern — a tile with a detected pattern chip */}
            <g transform="translate(380, 50)">
              <rect x="0" y="0" width="200" height="180" rx="14" fill="rgba(13,20,34,0.72)" stroke="rgba(0,209,216,0.32)" />
              <text x="20" y="30" fill="rgba(0,209,216,1)" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.12em">STEP 02</text>
              <text x="20" y="56" fill="#fff" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700">Detect pattern</text>
              <g transform="translate(20, 84)">
                <rect x="0" y="0" width="160" height="36" rx="18" fill="rgba(166,255,0,0.12)" stroke="rgba(166,255,0,0.5)" />
                <circle cx="22" cy="18" r="6" fill="rgb(166,255,0)" />
                <text x="38" y="23" fill="#fff" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="600">Singleton</text>
              </g>
              <text x="20" y="146" fill="rgba(226,228,240,0.7)" fontFamily="JetBrains Mono, monospace" fontSize="10">confidence: high</text>
              <text x="20" y="162" fill="rgba(226,228,240,0.5)" fontFamily="JetBrains Mono, monospace" fontSize="10">evidence: 3 anchors</text>
            </g>

            {/* Arrow 2 */}
            <g transform="translate(590, 130)">
              <line x1="0" y1="10" x2="60" y2="10" stroke="url(#ntdemoAccent)" strokeWidth="3" />
              <polygon points="60,2 76,10 60,18" fill="rgb(0,209,216)" />
            </g>

            {/* Step 3: Docs + Tests — split tile */}
            <g transform="translate(680, 50)">
              <rect x="0" y="0" width="240" height="180" rx="14" fill="rgba(13,20,34,0.72)" stroke="rgba(0,209,216,0.32)" />
              <text x="20" y="30" fill="rgba(0,209,216,1)" fontFamily="JetBrains Mono, monospace" fontSize="11" letterSpacing="0.12em">STEP 03</text>
              <text x="20" y="56" fill="#fff" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700">Docs + Tests</text>
              <g transform="translate(20, 82)">
                <rect x="0" y="0" width="200" height="42" rx="8" fill="rgba(123,94,167,0.18)" stroke="rgba(123,94,167,0.45)" />
                <text x="14" y="18" fill="rgba(226,228,240,0.9)" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600">README.md generated</text>
                <text x="14" y="34" fill="rgba(226,228,240,0.6)" fontFamily="JetBrains Mono, monospace" fontSize="10">## Logger</text>
              </g>
              <g transform="translate(20, 132)">
                <rect x="0" y="0" width="200" height="32" rx="8" fill="rgba(0,209,216,0.10)" stroke="rgba(0,209,216,0.45)" />
                <text x="14" y="20" fill="rgba(226,228,240,0.9)" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600">test_logger.cpp</text>
              </g>
            </g>
          </svg>
          <figcaption className="nt-home__demo-caption">
            Paste C++. CodiNeo tags the design pattern. You get a README and unit-test
            scaffolds for free.
          </figcaption>
        </figure>

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
          <MagneticButton variant="primary" onClick={dispatchTryItChooserOpen}>
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
              // D76: every feature tile previously routed straight to
              // /student-studio (the value in f.surface) and dropped the
              // user on the tester-seat picker. Now the tiles open the
              // path-choice modal first, same as every other "Try it" CTA.
              onClick={dispatchTryItChooserOpen}
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
        <MagneticButton variant="primary" onClick={dispatchTryItChooserOpen}>
          Try it now
        </MagneticButton>
      </section>
    </main>
  );
}
