import { motion, useReducedMotion } from 'motion/react';
import { navigate } from '../../lib/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import PipelineAnimation from './PipelineAnimation';

const SYSTEM_STEPS = [
  {
    title: 'Start with C++ Code',
    text: 'Paste or upload a C++ file in the studio.',
  },
  {
    title: 'Find Possible Patterns',
    text: 'The system checks class structures for signs of patterns like Singleton, Factory, Builder, Adapter, Proxy, Decorator, and Strategy.',
  },
  {
    title: 'See the Evidence',
    text: 'NeoTerritory highlights the code lines and class parts that support each detection.',
  },
  {
    title: 'Learn and Document',
    text: 'The results help users understand the pattern and prepare clearer documentation.',
  },
];

const ARCHITECTURE = [
  {
    title: 'Web Studio',
    label: 'React · TypeScript · Vite',
    text: 'This is where users submit C++ code and view the learning results.',
  },
  {
    title: 'Backend Coordinator',
    label: 'Express · TypeScript · SQLite',
    text: 'This receives the request, runs the analyzer, saves results, and prepares data for the frontend.',
  },
  {
    title: 'C++ Analyzer',
    label: 'C++17 Microservice',
    text: 'This performs the main pattern detection and creates the analysis report.',
  },
];

const FAMILIES = [
  {
    family: 'Creational Patterns',
    patterns: ['Singleton', 'Factory', 'Builder'],
    blurb: 'These patterns explain how objects are created.',
  },
  {
    family: 'Structural Patterns',
    patterns: ['Adapter', 'Proxy', 'Decorator'],
    blurb: 'These patterns explain how classes and objects are connected or wrapped.',
  },
  {
    family: 'Behavioral Patterns',
    patterns: ['Strategy Interface', 'Method Chaining'],
    blurb: 'These patterns explain how objects communicate or choose behavior.',
  },
  {
    family: 'C++ Idioms',
    patterns: ['Pimpl'],
    blurb: 'These are C++-specific techniques that support cleaner and more maintainable code.',
  },
];

const VALUES = [
  {
    title: 'Understand Unfamiliar Code',
    text: 'Helps users explore classes and see how a pattern may appear in implementation.',
  },
  {
    title: 'Learn Through Evidence',
    text: 'Shows why a pattern was detected by pointing to actual code structures.',
  },
  {
    title: 'Prepare Better Documentation',
    text: 'Gives documentation anchors and explanation targets that users can review and improve.',
  },
  {
    title: 'Support Thesis Evaluation',
    text: 'Saves runs, feedback, and review data for research evaluation.',
  },
];

const SCOPE = [
  'It is a learning and documentation-support tool.',
  'It is not a full C++ compiler.',
  'It does not automatically refactor or rewrite full systems.',
  'It uses custom token, class-structure, and pattern-rule analysis.',
  'AI explanation is optional.',
  'The main output is pattern evidence, annotations, documentation guidance, and review data.',
];

export default function HeroLanding() {
  const reduce = useReducedMotion();

  return (
    <main className="nt-hero" id="main">
      <section className="nt-hero__above" aria-labelledby="hero-heading">
        <div className="nt-hero__grain" aria-hidden />
        <div className="nt-hero__above-inner">
          <motion.p
            className="nt-hero__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Learn C++ design patterns through real code
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
            NeoTerritory helps interns and novice developers learn C++ design patterns by analyzing
            source code, highlighting evidence, and turning detected structures into documentation
            guidance.
          </motion.p>
          <motion.div
            className="nt-hero__ctas"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <MagneticButton
              variant="primary"
              onClick={() => navigate('/app')}
              ariaLabel="Open the analysis studio"
            >
              Open studio
            </MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => navigate('/learn')}
              ariaLabel="View the NeoTerritory workflow"
            >
              How it works
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
              <dd>C++ code</dd>
            </div>
            <div>
              <dt>Detect</dt>
              <dd>patterns</dd>
            </div>
            <div>
              <dt>Get</dt>
              <dd>documentation help</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <ScrollReveal as="section" className="nt-hero__workflow">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Evidence-based learning</p>
          <h2 className="nt-section-title">How NeoTerritory helps you learn</h2>
          <p className="nt-section-lede">
            Instead of only reading design-pattern definitions, users can connect each pattern to
            actual C++ code evidence.
          </p>
        </header>
        <div className="nt-card-grid nt-card-grid--four">
          {SYSTEM_STEPS.map((step, idx) => (
            <ScrollReveal as="article" key={step.title} className="nt-info-card" delay={idx * 0.06}>
              <p className="nt-info-card__num">{(idx + 1).toString().padStart(2, '0')}</p>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__families">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Beginner-friendly patterns</p>
          <h2 className="nt-section-title">Patterns you can learn from</h2>
          <p className="nt-section-lede">
            NeoTerritory focuses on common object-oriented patterns and C++ implementation idioms.
            Each detected pattern is shown with evidence, not just a label.
          </p>
        </header>
        <div className="nt-family-grid nt-family-grid--home">
          {FAMILIES.map((f, idx) => (
            <ScrollReveal as="article" key={f.family} className="nt-family-card" delay={idx * 0.08}>
              <p className="nt-family-card__family">{f.family}</p>
              <p className="nt-family-card__blurb">{f.blurb}</p>
              <ul className="nt-family-card__patterns">
                {f.patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__pipeline-section">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Guided workflow</p>
          <h2 className="nt-section-title">From code to explanation</h2>
          <p className="nt-section-lede">
            NeoTerritory follows a guided analysis flow so users can understand how a result was
            produced.
          </p>
        </header>
        <PipelineAnimation />
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__architecture">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Behind the scenes</p>
          <h2 className="nt-section-title">What happens behind the scenes</h2>
          <p className="nt-section-lede">
            The system has three parts working together.
          </p>
        </header>
        <div className="nt-card-grid nt-card-grid--three">
          {ARCHITECTURE.map((layer) => (
            <article key={layer.title} className="nt-info-card nt-info-card--layer">
              <p className="nt-info-card__label">{layer.label}</p>
              <h3>{layer.title}</h3>
              <p>{layer.text}</p>
            </article>
          ))}
        </div>
        <p className="nt-flow-line">
          <span>User</span>
          <span>Web Studio</span>
          <span>Backend</span>
          <span>C++ Analyzer</span>
          <span>Results</span>
        </p>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__ai">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Optional explanation</p>
          <h2 className="nt-section-title">AI helps explain, but it does not decide alone</h2>
          <p className="nt-section-lede">
            The main pattern detection comes from the C++ analyzer. AI is only used for extra
            explanation when available.
          </p>
        </header>
        <div className="nt-split-card">
          <article>
            <p className="nt-info-card__label">Rule-based evidence</p>
            <h3>C++ Analyzer</h3>
            <p>
              Finds possible design patterns using the system's rule-based analysis and code
              evidence.
            </p>
          </article>
          <article>
            <p className="nt-info-card__label">Provider-dependent</p>
            <h3>Optional AI Explanation</h3>
            <p>
              Adds beginner-friendly notes to help users understand the detected pattern, if an AI
              provider is configured.
            </p>
          </article>
        </div>
        <p className="nt-section-note">
          If AI is unavailable, NeoTerritory can still show pattern evidence and documentation
          targets.
        </p>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__research">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">For learners</p>
          <h2 className="nt-section-title">Made for interns and beginner developers</h2>
          <p className="nt-section-lede">
            NeoTerritory supports learning by connecting design-pattern theory with real source
            code.
          </p>
        </header>
        <div className="nt-card-grid nt-card-grid--four">
          {VALUES.map((item) => (
            <article key={item.title} className="nt-info-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__scope">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Honest scope</p>
          <h2 className="nt-section-title">What NeoTerritory is — and is not</h2>
        </header>
        <ul className="nt-scope-list">
          {SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__cta-band">
        <h2 className="nt-section-title">Try it with your own C++ code</h2>
        <p className="nt-section-lede">
          Open the studio, paste a C++ snippet, and see which design-pattern evidence NeoTerritory
          can find.
        </p>
        <div className="nt-hero__ctas">
          <MagneticButton variant="primary" onClick={() => navigate('/app')}>
            Open studio
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => navigate('/learn')}>
            Learn the workflow
          </MagneticButton>
        </div>
      </ScrollReveal>
    </main>
  );
}
