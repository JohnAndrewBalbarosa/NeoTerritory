import { motion, useReducedMotion } from 'motion/react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';
import PipelineAnimation from './PipelineAnimation';

const FAMILIES = [
  {
    family: 'Creational',
    patterns: ['Singleton', 'Factory', 'Builder', 'Method chaining'],
    blurb:
      'How instances are created — recognised so the AI can describe construction in one tag instead of paragraphs.',
  },
  {
    family: 'Behavioural',
    patterns: ['Strategy interface'],
    blurb:
      'How objects coordinate at runtime — the pipeline dispatches per-pattern templates so the same parse tree answers many questions.',
  },
  {
    family: 'Structural',
    patterns: ['Adapter', 'Proxy', 'Decorator'],
    blurb:
      'How objects compose — three wrapping shapes co-emit, then the AI disambiguates which role the wrapping plays.',
  },
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
            C++ design pattern analysis · AI documentation pipeline
          </motion.p>
          <h1 id="hero-heading" className="nt-hero__title">
            <SplitText text="Read patterns." as="span" className="nt-hero__title-row" />
            <SplitText
              text="Not just parse trees."
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
            NeoTerritory takes raw C++, lifts it into a structural model, tags every class with the
            design pattern it actually plays — Builder, Strategy, Decorator, more — and hands the
            AI a tiny evidence slice instead of a wall of source. Documentation gets shorter, more
            consistent, and far cheaper to generate.
          </motion.p>
          <motion.div
            className="nt-hero__ctas"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <MagneticButton
              variant="primary"
              onClick={() => navigate('/learn')}
              ariaLabel="Learn how the algorithm works"
            >
              Learn now
            </MagneticButton>
            <MagneticButton
              variant="ghost"
              onClick={() => navigate('/app')}
              ariaLabel="Open the analysis studio"
            >
              Open studio →
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
              <dt>8</dt>
              <dd>patterns shipped in catalog</dd>
            </div>
            <div>
              <dt>JSON-driven</dt>
              <dd>add a pattern without recompile</dd>
            </div>
          </motion.dl>
        </div>
      </section>

      <ScrollReveal as="section" className="nt-hero__pipeline-section">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">How the algorithm works</p>
          <h2 className="nt-section-title">Five deterministic stages</h2>
          <p className="nt-section-lede">
            Sourced directly from <code>Codebase/Microservice/Modules/Source/core.cpp</code>. The
            microservice never calls the network — every stage is reproducible from the same C++
            input.
          </p>
        </header>
        <PipelineAnimation />
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__families">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Three families, one engine</p>
          <h2 className="nt-section-title">
            Creational · Behavioural · Structural
          </h2>
          <p className="nt-section-lede">
            Each family answers a different question. The same five-stage pipeline serves all
            three, and adding a new pattern is a JSON file — no recompile.
          </p>
        </header>
        <div className="nt-family-grid">
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

      <ScrollReveal as="section" className="nt-hero__cta-band">
        <h2 className="nt-section-title">Ready to see it on real code?</h2>
        <p className="nt-section-lede">
          Drop in a C++ snippet, get tagged classes, AI documentation, and a unit-test scaffold.
        </p>
        <div className="nt-hero__ctas">
          <MagneticButton variant="primary" onClick={() => navigate('/app')}>
            Open studio
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => navigate('/learn')}>
            Read the deep dive
          </MagneticButton>
        </div>
      </ScrollReveal>
    </main>
  );
}
