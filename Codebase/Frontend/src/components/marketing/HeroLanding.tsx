import { motion, useReducedMotion } from 'motion/react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';
import SplitText from './effects/SplitText';

const HELP_STEPS = [
  {
    title: 'Paste your code',
    text: 'Add a C++ snippet or file to the studio.',
  },
  {
    title: 'See possible patterns',
    text: 'CodiNeo checks whether your code looks like a known design pattern.',
  },
  {
    title: 'Find the important parts',
    text: 'The system points to the classes and code parts related to the pattern.',
  },
  {
    title: 'Read a simpler explanation',
    text: 'You get beginner-friendly explanations and documentation guidance.',
  },
];

const FAMILIES = [
  {
    family: 'Creational Patterns',
    patterns: ['Singleton', 'Factory', 'Builder'],
    blurb: 'These patterns help explain how objects are created.',
  },
  {
    family: 'Structural Patterns',
    patterns: ['Adapter', 'Proxy', 'Decorator'],
    blurb: 'These patterns show how classes or objects are connected.',
  },
  {
    family: 'Behavioral Patterns',
    patterns: ['Strategy', 'Method Chaining'],
    blurb: 'These patterns show how objects communicate or choose behavior.',
  },
  {
    family: 'C++ Idioms',
    patterns: ['Pimpl'],
    blurb: 'These are common C++ coding techniques that improve structure.',
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

const STUDIO_OUTPUTS = [
  {
    title: 'Pattern name',
    text: 'The possible design pattern found in your code.',
  },
  {
    title: 'Code highlights',
    text: 'The lines or structures that helped the system detect it.',
  },
  {
    title: 'Simple explanation',
    text: 'A beginner-friendly explanation of what the pattern does.',
  },
  {
    title: 'Documentation help',
    text: 'Notes that can help you write clearer documentation.',
  },
];

const TECH_PARTS = [
  {
    title: 'Web studio',
    label: 'React · TypeScript · Vite',
    text: 'The page where you submit code and read the results.',
  },
  {
    title: 'Backend',
    label: 'Express · TypeScript · SQLite',
    text: 'The part that receives the request and prepares the saved result.',
  },
  {
    title: 'C++ analyzer',
    label: 'C++17',
    text: 'The part that checks the C++ code and creates the report.',
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
        <div className="nt-card-grid nt-card-grid--four">
          {HELP_STEPS.map((step, idx) => (
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
          <p className="nt-section-eyebrow">Beginner pattern guide</p>
          <h2 className="nt-section-title">Patterns you can learn from</h2>
          <p className="nt-section-lede">
            CodiNeo focuses on common patterns that beginners often meet in object-oriented
            programming.
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
        <p className="nt-section-note">
          CodiNeo shows each pattern with code-based clues, not just a label.
        </p>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__pipeline-section">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Simple workflow</p>
          <h2 className="nt-section-title">How it works</h2>
        </header>
        <div className="nt-simple-steps">
          {SIMPLE_WORKFLOW.map((step, idx) => (
            <article key={step.title} className="nt-simple-step">
              <span className="nt-simple-step__num">Step {idx + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <p className="nt-section-note">
          Want the technical view? See the full analysis workflow in the learning page.
        </p>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__outputs">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Inside the studio</p>
          <h2 className="nt-section-title">What you will see in the studio</h2>
        </header>
        <div className="nt-card-grid nt-card-grid--four">
          {STUDIO_OUTPUTS.map((item) => (
            <article key={item.title} className="nt-info-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__architecture nt-compact-section">
        <header className="nt-section-head">
          <p className="nt-section-eyebrow">Behind the scenes</p>
          <h2 className="nt-section-title">Behind the scenes</h2>
          <p className="nt-section-lede">
            CodiNeo has three parts working together.
          </p>
        </header>
        <div className="nt-card-grid nt-card-grid--three">
          {TECH_PARTS.map((part) => (
            <article key={part.title} className="nt-info-card nt-info-card--layer">
              <p className="nt-info-card__label">{part.label}</p>
              <h3>{part.title}</h3>
              <p>{part.text}</p>
            </article>
          ))}
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__ai nt-compact-section">
        <div className="nt-concept-card nt-concept-card--compact">
          <header className="nt-section-head">
            <p className="nt-section-eyebrow">Extra help</p>
            <h2 className="nt-section-title">Optional AI explanation</h2>
          </header>
          <div className="nt-concept-copy">
            <p>
              CodiNeo mainly detects patterns using its C++ analyzer. If AI is available, it
              can add extra beginner-friendly explanations.
            </p>
            <p>
              If AI is not available, the system can still show pattern matches and code
              highlights.
            </p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="nt-hero__cta-band">
        <h2 className="nt-section-title">Try it with your own C++ code</h2>
        <p className="nt-section-lede">
          Open the studio, paste a C++ snippet, and see what design patterns CodiNeo may find.
        </p>
        <div className="nt-hero__ctas">
          <MagneticButton variant="primary" onClick={() => navigate('/choose')}>
            Open studio
          </MagneticButton>
          <MagneticButton variant="ghost" onClick={() => navigate('/learn')}>
            See how it works
          </MagneticButton>
        </div>
      </ScrollReveal>
    </main>
  );
}
