import { motion, useReducedMotion } from 'motion/react';
import { navigate } from '../../lib/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import PipelineAnimation from './PipelineAnimation';

const SYSTEM_STEPS = [
  {
    title: 'Submit C++ Source',
    text: 'Users paste or upload C++ files through the browser-based studio.',
  },
  {
    title: 'Detect Pattern Evidence',
    text: 'The C++ microservice checks class-level structures against catalog-defined design-pattern rules.',
  },
  {
    title: 'Annotate the Source',
    text: 'The frontend displays pattern-related line evidence and class-level annotations.',
  },
  {
    title: 'Generate Documentation Support',
    text: 'The system presents documentation anchors, explanation targets, optional unit-test targets, and optional AI commentary.',
  },
];

const ARCHITECTURE = [
  {
    title: 'Frontend Layer',
    label: 'React · TypeScript · Vite',
    text: 'Handles source submission, annotated source display, documentation views, saved runs, and research workflow screens.',
  },
  {
    title: 'Backend Layer',
    label: 'Express · TypeScript · SQLite',
    text: 'Validates input, coordinates the microservice, normalizes reports, manages saved runs, and supports research/admin APIs.',
  },
  {
    title: 'C++ Analysis Layer',
    label: 'C++17 Microservice',
    text: 'Performs deterministic tokenization, parse-tree construction, pattern dispatch, hash linking, and report generation.',
  },
];

const FAMILIES = [
  {
    family: 'Creational',
    patterns: ['Singleton', 'Factory', 'Builder'],
    blurb:
      'Identifies object-creation structures and class responsibilities that may support creational pattern documentation.',
  },
  {
    family: 'Structural',
    patterns: ['Adapter', 'Proxy', 'Decorator'],
    blurb:
      'Highlights classes that wrap, forward, adapt, or compose behavior across related objects.',
  },
  {
    family: 'Behavioral',
    patterns: ['Strategy Interface', 'Method Chaining'],
    blurb:
      'Detects coordination and interaction structures that explain how objects communicate at runtime.',
  },
  {
    family: 'Idioms',
    patterns: ['Pimpl'],
    blurb:
      'Captures C++-specific implementation idioms that support maintainability and interface separation.',
  },
];

const VALUES = [
  {
    title: 'Code Understanding',
    text: 'Helps users inspect unfamiliar C++ classes and see why a pattern may have been detected.',
  },
  {
    title: 'Documentation Support',
    text: 'Produces documentation anchors and explanation targets that guide more consistent project documentation.',
  },
  {
    title: 'Review and Evaluation',
    text: 'Supports saved runs, manual review, feedback collection, and research evaluation workflows.',
  },
];

const SCOPE = [
  'Not a full C++ compiler.',
  'Not a complete automatic refactoring tool.',
  'Uses a custom token-stream, parse-tree, and catalog-matching pipeline.',
  'AI commentary is optional and provider-dependent.',
  'Primary output is pattern evidence, annotations, documentation support, and review data.',
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
            C++ pattern analysis · documentation support · DEVCON Luzon
          </motion.p>
          <h1 id="hero-heading" className="nt-hero__title">
            <SplitText text="Understand C++ patterns." as="span" className="nt-hero__title-row" />
            <SplitText
              text="Document code with evidence."
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
            NeoTerritory helps interns and novice developers understand unfamiliar C++ code by
            detecting design-pattern evidence, highlighting related source lines, and generating
            documentation-oriented outputs for review.
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
              View workflow
            </MagneticButton>
          </motion.div>
          <motion.dl
            className="nt-hero__stats"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            <div>
              <dt>5</dt>
              <dd>pipeline stages</dd>
            </div>
            <div>
              <dt>3</dt>
              <dd>runtime layers</dd>
            </div>
            <div>
              <dt>JSON</dt>
              <dd>pattern catalog</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <ScrollReveal as="section" className="nt-hero__workflow">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">What the system does</p>
          <h2 className="nt-section-title">What NeoTerritory does</h2>
          <p className="nt-section-lede">
            A guided workflow for C++ code understanding, design-pattern evidence, and
            documentation support.
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

      <ScrollReveal as="section" className="nt-hero__pipeline-section">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">System workflow</p>
          <h2 className="nt-section-title">Deterministic analysis pipeline</h2>
          <p className="nt-section-lede">
            The backend coordinates the request, while the C++ microservice performs the primary
            structural analysis.
          </p>
        </header>
        <PipelineAnimation />
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__architecture">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Architecture</p>
          <h2 className="nt-section-title">Three-layer thesis architecture</h2>
          <p className="nt-section-lede">
            NeoTerritory separates the user interface, orchestration layer, and deterministic C++
            analysis engine.
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
          <span>Browser</span>
          <span>Express Backend</span>
          <span>C++ Microservice</span>
          <span>report.json</span>
          <span>Annotated Results</span>
        </p>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__families">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Pattern catalog</p>
          <h2 className="nt-section-title">Catalog-based design-pattern detection</h2>
          <p className="nt-section-lede">
            Pattern rules are loaded from JSON catalog files, allowing the analyzer to compare C++
            class structures against known implementation evidence.
          </p>
        </header>
        <div className="nt-family-grid nt-family-grid--home">
          {FAMILIES.map((f, idx) => (
            <ScrollReveal as="article" key={f.family} className="nt-family-card" delay={idx * 0.08}>
              <p className="nt-family-card__family">{f.family}</p>
              <ul className="nt-family-card__patterns">
                {f.patterns.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="nt-family-card__blurb">{f.blurb}</p>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__ai">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">AI role clarification</p>
          <h2 className="nt-section-title">AI explains. The microservice detects.</h2>
          <p className="nt-section-lede">
            AI commentary is optional. The deterministic C++ analyzer remains the source of pattern
            detection.
          </p>
        </header>
        <div className="nt-split-card">
          <article>
            <p className="nt-info-card__label">Deterministic Analyzer</p>
            <h3>Primary detection</h3>
            <p>
              Primary detection comes from the C++ microservice, including structural analysis,
              annotations, pattern rankings, and documentation targets.
            </p>
          </article>
          <article>
            <p className="nt-info-card__label">Optional AI Commentary</p>
            <h3>Beginner-friendly explanation</h3>
            <p>
              When Gemini or Anthropic is configured, AI can generate explanations. If AI is
              unavailable, the system still returns deterministic analysis outputs.
            </p>
          </article>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__research">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Research value</p>
          <h2 className="nt-section-title">Built for onboarding and design-pattern learning</h2>
          <p className="nt-section-lede">
            NeoTerritory supports DEVCON Luzon's learning-oriented environment by helping interns
            review unfamiliar code with visible evidence instead of relying only on manual
            explanation.
          </p>
        </header>
        <div className="nt-card-grid nt-card-grid--three">
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
          <h2 className="nt-section-title">Current system scope</h2>
        </header>
        <ul className="nt-scope-list">
          {SCOPE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__cta-band">
        <h2 className="nt-section-title">Ready to analyze C++ code?</h2>
        <p className="nt-section-lede">
          Open the studio, submit a C++ snippet, inspect detected pattern evidence, and review the
          generated documentation targets.
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
