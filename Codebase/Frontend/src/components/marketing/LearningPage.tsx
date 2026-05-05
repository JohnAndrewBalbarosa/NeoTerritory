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

type Lesson = {
  id: string;
  name: string;
  file: string;
  intent: string;
  tells: string[];
  test: string;
};

type Module = {
  id: string;
  family: string;
  folder: string;
  tagline: string;
  blurb: string;
  inheritanceDriven?: boolean;
  lessons: Lesson[];
};

const MODULES: Module[] = [
  {
    id: 'creational',
    family: 'Creational',
    folder: 'pattern_catalog/creational/',
    tagline: 'How instances come into existence.',
    blurb:
      'Each lesson here governs a different construction shape — fluent assembly, role-based dispatch, chained mutation, or single-instance enforcement. The detector reads structural tells (return *this, terminator names, factory return types) and emits a pattern_id plus the captured class_name so test templates can be parameterised.',
    lessons: [
      {
        id: 'creational.builder',
        name: 'Builder',
        file: 'creational/builder.json',
        intent:
          'Assemble a complex object step-by-step through fluent setters that culminate in a terminator returning the product.',
        tells: ['return *this;', 'Builder& set…(…)', 'build() / finalize() / produce()'],
        test:
          'builder.test.template.cpp parameterises on class_name and the captured terminator; asserts chained setters compile and the terminator returns the product.',
      },
      {
        id: 'creational.factory',
        name: 'Factory',
        file: 'creational/factory.json',
        intent:
          'Centralise creation of one of several related types behind a single function or static method that decides the concrete class.',
        tells: ['static create(…)', 'switch on a type-tag', 'returns base pointer / variant'],
        test:
          'factory.test.template.cpp asserts each input tag dispatches to the expected concrete subclass and that the returned pointer is non-null and of the right dynamic type.',
      },
      {
        id: 'creational.method_chaining',
        name: 'Method chaining',
        file: 'creational/method_chaining.json',
        intent:
          'Mutate-in-place fluent style — like Builder but without a distinct terminator. Each call returns *this for ergonomics.',
        tells: ['return *this;', 'no build()/finalize()', 'callers chain ≥ 2 mutators'],
        test:
          'method_chaining.test.template.cpp asserts that two consecutive mutators compile against one expression and that the final state matches the union of the two calls.',
      },
      {
        id: 'creational.singleton',
        name: 'Singleton',
        file: 'creational/singleton.json',
        intent:
          'Guarantee exactly one instance of a class for the lifetime of the process, accessed through a static accessor.',
        tells: ['static instance() / getInstance()', 'private ctor', 'deleted copy / move'],
        test:
          'singleton.test.template.cpp asserts two calls to instance() return the same address and that copy / move construction is rejected at compile time.',
      },
    ],
  },
  {
    id: 'behavioural',
    family: 'Behavioural',
    folder: 'pattern_catalog/behavioural/',
    tagline: 'How objects coordinate at runtime.',
    blurb:
      'Behavioural patterns are about dispatch, not shape. The catalog encodes a parent role (the interface) and — when the pattern is inheritance-driven — a sibling subclass.json that defines the matcher for child roles. The microservice cascades the parent tag down the hierarchy so each child carries the same role hint without a fresh AI round-trip.',
    inheritanceDriven: true,
    lessons: [
      {
        id: 'behavioural.strategy_interface',
        name: 'Strategy · interface',
        file: 'behavioural/strategy_interface.json',
        intent:
          'Define a polymorphic role: an abstract base whose virtual methods will be supplied by interchangeable concrete strategies.',
        tells: ['virtual …(…) = 0;', 'public abstract base', 'no member state'],
        test:
          'strategy_interface.test.template.cpp asserts the interface is abstract (cannot be instantiated) and that the virtual method signature matches what concrete strategies must override.',
      },
      {
        id: 'behavioural.strategy_concrete',
        name: 'Strategy · concrete (child role)',
        file: 'behavioural/strategy_interface/subclass.json',
        intent:
          'Resolved automatically: any class deriving from a tagged Strategy interface is itself tagged as a concrete strategy via the subclass.json matcher.',
        tells: ['class X : public Interface', 'override on each virtual', 'one role per class'],
        test:
          'strategy_concrete.test.template.cpp parameterises per concrete strategy. The detector emits one unit_test_target per polymorphic call site; the test asserts the correct concrete strategy gets dispatched.',
      },
    ],
  },
  {
    id: 'structural',
    family: 'Structural',
    folder: 'pattern_catalog/structural/',
    tagline: 'How objects compose into bigger objects.',
    blurb:
      'Adapter, Proxy, and Decorator share the same wrapping signature — a class that holds a reference / pointer to another and forwards calls. The catalog co-emits all three candidates; the AI disambiguates from a small candidate set rather than re-deriving the wrap shape from raw source on every request.',
    lessons: [
      {
        id: 'structural.adapter',
        name: 'Adapter',
        file: 'structural/adapter.json',
        intent:
          'Translate one interface into another the caller already expects. The wrapped target has a different shape than the wrapper exposes.',
        tells: ['ctor takes the adaptee', 'wrapper signature ≠ adaptee signature', 'forwarding with translation'],
        test:
          'adapter.test.template.cpp constructs the adapter around a fake adaptee and asserts the translated method maps inputs / outputs the way the new interface promises.',
      },
      {
        id: 'structural.decorator',
        name: 'Decorator',
        file: 'structural/decorator.json',
        intent:
          'Wrap a target while preserving its interface, layering extra behaviour around a forwarded call. Decorators stack.',
        tells: ['same interface as inner', 'new Outer(new Inner)', 'pre/post work around forward'],
        test:
          'decorator.test.template.cpp templates a chain construction and asserts the outer\'s decorated method calls into the inner exactly once with the expected arguments.',
      },
      {
        id: 'structural.proxy',
        name: 'Proxy',
        file: 'structural/proxy.json',
        intent:
          'Stand in for a target — same interface, but the proxy controls access (lazy load, remote call, permission check) before forwarding.',
        tells: ['same interface as target', 'gating / lazy logic before forward', 'one target, not a chain'],
        test:
          'proxy.test.template.cpp asserts the gating predicate fires before forwarding and that suppressed calls never reach the target.',
      },
    ],
  },
  {
    id: 'idiom',
    family: 'Idiom',
    folder: 'pattern_catalog/idiom/',
    tagline: 'C++-specific shapes that are not GoF patterns but recur enough to deserve a name.',
    blurb:
      'Idioms live alongside the canonical families because their tells are just as structural. They get the same matcher pipeline and the same test-template treatment — only the family label changes.',
    lessons: [
      {
        id: 'idiom.pimpl',
        name: 'Pimpl (pointer-to-implementation)',
        file: 'idiom/pimpl.json',
        intent:
          'Hide a class\'s data members behind a forward-declared inner struct held by a smart pointer, so the header reveals nothing about layout.',
        tells: ['struct Impl; (forward decl)', 'std::unique_ptr<Impl>', 'every method delegates via pImpl->'],
        test:
          'A pimpl template (when added) asserts that the public header does not include the impl definition and that public methods compile against only the forward declaration.',
      },
    ],
  },
];

const META_MODULES: Array<{
  id: string;
  title: string;
  path: string;
  blurb: string;
}> = [
  {
    id: 'inheritance-index',
    title: 'inheritance_driven_patterns.json',
    path: 'pattern_catalog/inheritance_driven_patterns.json',
    blurb:
      'Authoring index that lists which patterns require parent → child tag propagation. Add a pattern\'s short name under its family to enable the cascade; remove it to stop. The microservice resolves each child matcher at pattern_catalog/{family}/{pattern}/subclass.json. Runtime never mutates this file.',
  },
  {
    id: 'runtime-introspect',
    title: '_runtime/introspect.hpp',
    path: 'pattern_catalog/_runtime/introspect.hpp',
    blurb:
      'Header shipped alongside the catalog so generated tests and downstream tooling can introspect captured tags at compile time. Lives under _runtime/ to make clear it is infrastructure, not a pattern entry.',
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

      <ScrollReveal as="section" className="nt-learn__curriculum">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Curriculum · pattern modules</p>
          <h2 className="nt-section-title">How the catalog is laid out</h2>
          <p className="nt-section-lede">
            The catalog under <code>Codebase/Microservice/pattern_catalog/</code> is partitioned by
            <em> pattern family</em>. Each family is a folder; each pattern is a{' '}
            <code>&lt;name&gt;.json</code> matcher paired with a{' '}
            <code>&lt;name&gt;.test.template.cpp</code>. Read each module top-down: the family
            governs <em>what kind of problem</em> the pattern solves, the lessons inside govern{' '}
            <em>which exact shape</em> the detector is looking for and what its test template
            proves.
          </p>
        </header>

        <div className="nt-curriculum">
          {MODULES.map((m, idx) => (
            <ScrollReveal as="article" key={m.id} className="nt-module" delay={idx * 0.06}>
              <header className="nt-module__head">
                <p className="nt-module__num">M{(idx + 1).toString().padStart(2, '0')}</p>
                <div className="nt-module__heading">
                  <h3 className="nt-module__name">
                    {m.family}
                    {m.inheritanceDriven && (
                      <span className="nt-module__tag" title="Parent → child tag propagation enabled">
                        inheritance-driven
                      </span>
                    )}
                  </h3>
                  <p className="nt-module__path">
                    <code>{m.folder}</code>
                  </p>
                </div>
              </header>
              <p className="nt-module__tagline">{m.tagline}</p>
              <p className="nt-module__blurb">{m.blurb}</p>

              <ol className="nt-lessons">
                {m.lessons.map((lesson, lIdx) => (
                  <li key={lesson.id} className="nt-lesson">
                    <div className="nt-lesson__head">
                      <span className="nt-lesson__num">
                        {(idx + 1).toString().padStart(2, '0')}.{(lIdx + 1).toString().padStart(2, '0')}
                      </span>
                      <h4 className="nt-lesson__name">{lesson.name}</h4>
                      <code className="nt-lesson__file">{lesson.file}</code>
                    </div>
                    <p className="nt-lesson__intent">{lesson.intent}</p>
                    <dl className="nt-lesson__meta">
                      <div>
                        <dt>Structural tells</dt>
                        <dd>
                          <ul className="nt-lesson__tells">
                            {lesson.tells.map((t) => (
                              <li key={t}>
                                <code>{t}</code>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                      <div>
                        <dt>What the test template proves</dt>
                        <dd>{lesson.test}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </ScrollReveal>
          ))}

          <ScrollReveal as="article" className="nt-module nt-module--meta">
            <header className="nt-module__head">
              <p className="nt-module__num">M·∞</p>
              <div className="nt-module__heading">
                <h3 className="nt-module__name">Catalog infrastructure</h3>
                <p className="nt-module__path">
                  <code>pattern_catalog/_runtime/</code> ·{' '}
                  <code>inheritance_driven_patterns.json</code>
                </p>
              </div>
            </header>
            <p className="nt-module__tagline">
              Cross-cutting files that every family relies on but no family owns.
            </p>
            <ul className="nt-meta-list">
              {META_MODULES.map((meta) => (
                <li key={meta.id} className="nt-meta-list__item">
                  <p className="nt-meta-list__title">
                    <code>{meta.title}</code>
                  </p>
                  <p className="nt-meta-list__path">{meta.path}</p>
                  <p className="nt-meta-list__blurb">{meta.blurb}</p>
                </li>
              ))}
            </ul>
          </ScrollReveal>

          <ScrollReveal as="article" className="nt-module nt-module--howto">
            <header className="nt-module__head">
              <p className="nt-module__num">+</p>
              <div className="nt-module__heading">
                <h3 className="nt-module__name">Adding a new family</h3>
                <p className="nt-module__path">
                  <code>pattern_catalog/&lt;new_family&gt;/</code>
                </p>
              </div>
            </header>
            <ol className="nt-howto">
              <li>
                Create <code>pattern_catalog/&lt;family&gt;/</code> alongside the existing four.
              </li>
              <li>
                For each pattern, drop a <code>&lt;pattern&gt;.json</code> matcher (lexeme
                identifiers, ordered checks, implementation_template) and a sibling{' '}
                <code>&lt;pattern&gt;.test.template.cpp</code>.
              </li>
              <li>
                If the pattern needs parent → child tag propagation, add a{' '}
                <code>&lt;pattern&gt;/subclass.json</code> and register the short name under your
                family in <code>inheritance_driven_patterns.json</code>.
              </li>
              <li>
                The microservice picks the new family up automatically — no code changes are
                required for the matcher pipeline to enumerate it.
              </li>
            </ol>
          </ScrollReveal>
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
