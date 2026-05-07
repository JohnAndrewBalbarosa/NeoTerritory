import { navigate } from '../../lib/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';

const MODULES = [
  {
    title: 'What is a design pattern?',
    text: 'A design pattern is a common way to solve a programming problem.',
  },
  {
    title: 'Creational Patterns',
    text: 'These patterns explain simple ways to create objects.',
    examples: ['Singleton', 'Factory', 'Builder'],
  },
  {
    title: 'Structural Patterns',
    text: 'These patterns show how classes or objects connect, wrap, or work together.',
    examples: ['Adapter', 'Proxy', 'Decorator'],
  },
  {
    title: 'Behavioral Patterns',
    text: 'These patterns show how objects communicate or choose behavior.',
    examples: ['Strategy', 'Method Chaining'],
  },
  {
    title: 'Try it with C++ Code',
    text: 'Open the Studio, paste a C++ snippet, and review the possible pattern matches.',
  },
];

export default function StudentLearningHub() {
  return (
    <main className="nt-student" id="main">
      <section className="nt-student__hero" aria-labelledby="student-heading">
        <p className="nt-section-eyebrow">Student learning</p>
        <h1 id="student-heading" className="nt-student__title">
          Learn design patterns first
        </h1>
        <p className="nt-student__lede">
          Start with the basics, then try NeoTerritory with real C++ code.
        </p>
      </section>

      <section className="nt-module-grid" aria-label="Design pattern learning modules">
        {MODULES.map((module, idx) => (
          <ScrollReveal as="article" key={module.title} className="nt-module-card" delay={idx * 0.06}>
            <p className="nt-module-card__num">Module {idx + 1}</p>
            <h2>{module.title}</h2>
            <p>{module.text}</p>
            {'examples' in module && module.examples && (
              <ul className="nt-module-card__chips" aria-label={`${module.title} examples`}>
                {module.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            )}
          </ScrollReveal>
        ))}
      </section>

      <section className="nt-student__cta" aria-label="Student learning actions">
        <MagneticButton variant="primary" onClick={() => navigate('/student-studio')}>
          Open studio
        </MagneticButton>
        <MagneticButton variant="ghost" onClick={() => navigate('/choose')}>
          Back to choices
        </MagneticButton>
      </section>
    </main>
  );
}
