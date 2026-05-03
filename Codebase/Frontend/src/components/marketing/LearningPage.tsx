import { navigate } from '../../lib/router';
import { useOverflowGuard } from '../../hooks/useOverflowGuard';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import PatternAtlas from './PatternAtlas';

const VALUE_PROPS: Array<{
  id: 'readability' | 'ai-tokens' | 'unit-tests';
  title: string;
  blurb: string;
}> = [
  {
    id: 'readability',
    title: 'Readability',
    blurb:
      'Naming the shape is the smallest unit of comprehension. "This is a Builder" replaces a paragraph of prose about fluent setters and a terminator method.',
  },
  {
    id: 'ai-tokens',
    title: 'AI documentation · token reduction',
    blurb:
      'Once the structural verdict is in, the backend hands the AI a pattern_id plus a virtual-copy slice — not the whole project. Inputs shrink. Outputs become deterministic.',
  },
  {
    id: 'unit-tests',
    title: 'Unit-test templating',
    blurb:
      'Every catalog pattern ships a .test.template.cpp. The detector emits unit_test_targets; the template gets parameterised with class + method names. You only fill in expected values.',
  },
];

const FAMILIES: Array<{
  id: string;
  family: string;
  oneLine: string;
  readability: string;
  aiTokens: string;
  unitTests: string;
}> = [
  {
    id: 'creational',
    family: 'Creational',
    oneLine: 'Patterns that govern how instances come into existence.',
    readability:
      'Reading a Builder is reading three things: state, fluent setters, terminator. Once tagged, the reader does not re-derive that shape every time.',
    aiTokens:
      'Builder + class slice → AI returns documentation in one short paragraph plus per-method notes. Sending the whole TU costs 5–10× more tokens for worse output.',
    unitTests:
      'creational/builder.test.template.cpp parameterises on the captured class_name and the build() terminator name. The generated test exercises chained setters and asserts the terminator returns the product.',
  },
  {
    id: 'behavioural',
    family: 'Behavioural',
    oneLine: 'Patterns that govern how objects coordinate at runtime.',
    readability:
      'Strategy is "polymorphism with intent." Tagging makes the intent explicit so the next reader does not have to follow an interface graph to find out why.',
    aiTokens:
      'Strategy interface tag tells the model the parent role. The microservice cascades the tag to subclasses (per inheritance_driven_patterns.json), so each child carries the same role hint without a fresh AI round-trip.',
    unitTests:
      'strategy_concrete.test.template.cpp parameterises per concrete strategy. The detector emits one unit_test_target per polymorphic call site, so the generated test asserts the correct concrete strategy gets dispatched.',
  },
  {
    id: 'structural',
    family: 'Structural',
    oneLine: 'Patterns that govern how objects compose into bigger objects.',
    readability:
      'Adapter, Proxy, Decorator share a wrapping signature. The catalog co-emits all three; the page that names them makes the difference legible to humans.',
    aiTokens:
      'Class slice + the candidate set (e.g. {Adapter, Proxy, Decorator}) is enough for the AI to disambiguate in one short turn. Re-deriving the structural co-emission from raw source bloats every prompt.',
    unitTests:
      'decorator.test.template.cpp templates a chain construction (new Outer(new Inner)) and asserts the outer\'s decorated method calls into the inner. The detector\'s unit_test_targets pin the forwarded method name.',
  },
];

export default function LearningPage() {
  // Dev-only viewport overflow detector. Logs offending elements to the
  // console with their delta in pixels. No-op in production builds.
  useOverflowGuard({ rootSelector: '.nt-learn', tolerancePx: 2 });

  return (
    <main className="nt-learn" id="main">
      <section className="nt-learn__hero" aria-labelledby="learn-heading">
        <p className="nt-section-eyebrow">The case for design patterns</p>
        <h1 id="learn-heading" className="nt-learn__title">
          <SplitText text="Names compress ideas." as="span" />
        </h1>
        <p className="nt-learn__lede">
          A design pattern is a name attached to a shape that recurs. Once a class wears the right
          name, three things get cheaper at once: human reading, AI documentation, and the unit
          tests that protect both.
        </p>
      </section>

      <ScrollReveal as="section" className="nt-learn__props">
        <div className="nt-prop-grid">
          {VALUE_PROPS.map((p, idx) => (
            <ScrollReveal as="article" key={p.id} className="nt-prop-card" delay={idx * 0.08}>
              <p className="nt-prop-card__num">{(idx + 1).toString().padStart(2, '0')}</p>
              <h3 className="nt-prop-card__title">{p.title}</h3>
              <p className="nt-prop-card__blurb">{p.blurb}</p>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-learn__matrix">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">3 × 3 matrix</p>
          <h2 className="nt-section-title">Pattern family × value prop</h2>
          <p className="nt-section-lede">
            Each row is a family. Each column is one of the three benefits. Read across to see what
            tagging buys you in that family.
          </p>
        </header>
        <div className="nt-matrix">
          <div className="nt-matrix__head" aria-hidden>
            <span />
            <span>Readability</span>
            <span>AI documentation</span>
            <span>Unit-test templating</span>
          </div>
          {FAMILIES.map((f) => (
            <ScrollReveal as="div" key={f.id} className="nt-matrix__row">
              <div className="nt-matrix__rowhead">
                <p className="nt-matrix__rowname">{f.family}</p>
                <p className="nt-matrix__rowblurb">{f.oneLine}</p>
              </div>
              <div className="nt-matrix__cell">
                <p>{f.readability}</p>
              </div>
              <div className="nt-matrix__cell">
                <p>{f.aiTokens}</p>
              </div>
              <div className="nt-matrix__cell">
                <p>{f.unitTests}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-learn__atlas">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Pattern atlas · static catalog</p>
          <h2 className="nt-section-title">Tag → source → generated test</h2>
          <p className="nt-section-lede">
            Six entries, one per detected pattern. Each shows the C++ sample the detector reads,
            the test template it instantiates, the placeholder substitutions taken from the
            detector&rsquo;s <code>unit_test_targets</code>, and a per-pattern explanation of what
            the test asserts and why. Files are imported live from{' '}
            <code>Codebase/Microservice/samples/</code> and{' '}
            <code>Codebase/Microservice/pattern_catalog/</code> — nothing is mocked.
          </p>
        </header>
        <PatternAtlas />
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-learn__cta">
        <h2 className="nt-section-title">See your own code tagged</h2>
        <p className="nt-section-lede">
          Drop a snippet in the studio. The same pipeline runs in under a second on small files.
        </p>
        <div className="nt-hero__ctas">
          <MagneticButton variant="primary" onClick={() => navigate('/app')}>
            Open studio
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => navigate('/about')}>
            Meet the team
          </MagneticButton>
        </div>
      </ScrollReveal>
    </main>
  );
}
