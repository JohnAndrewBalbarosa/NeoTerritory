import { navigate } from '../../lib/router';
import MagneticButton from './effects/MagneticButton';
import ScrollReveal from './effects/ScrollReveal';

const ENTRY_OPTIONS = [
  {
    title: 'Tester',
    label: 'Thesis evaluation',
    text: 'Participate in the thesis evaluation and submit feedback.',
    action: 'Start as tester',
    path: '/login',
  },
  {
    title: 'Developer',
    label: 'Documentation tool',
    text: 'Use NeoTerritory as a C++ pattern documentation tool.',
    action: 'Open developer studio',
    path: '/developer',
  },
  {
    title: 'Student Learning',
    label: 'Beginner path',
    text: 'Learn design-pattern basics before trying the analyzer.',
    action: 'Start learning',
    path: '/student-learning',
  },
  {
    title: 'Admin',
    label: 'Protected dashboard',
    text: 'Manage tester seats, saved runs, feedback, logs, and exports.',
    action: 'Admin sign in',
    path: '/app',
  },
];

export default function EntryChoice() {
  return (
    <main className="nt-entry" id="main">
      <section className="nt-entry__hero" aria-labelledby="entry-heading">
        <p className="nt-section-eyebrow">Choose your path</p>
        <h1 id="entry-heading" className="nt-entry__title">
          How do you want to use NeoTerritory?
        </h1>
        <p className="nt-entry__lede">
          Pick the entry that matches your role. The Studio and analyzer stay the same behind each
          path.
        </p>
      </section>

      <section className="nt-entry-grid" aria-label="NeoTerritory entry paths">
        {ENTRY_OPTIONS.map((option, idx) => (
          <ScrollReveal as="article" key={option.title} className="nt-entry-card" delay={idx * 0.06}>
            <p className="nt-entry-card__label">{option.label}</p>
            <h2>{option.title}</h2>
            <p>{option.text}</p>
            <div className="nt-entry-card__actions">
              <MagneticButton
                variant={option.title === 'Admin' ? 'ghost' : 'primary'}
                onClick={() => navigate(option.path)}
              >
                {option.action}
              </MagneticButton>
            </div>
          </ScrollReveal>
        ))}
      </section>
    </main>
  );
}
