import { navigate } from '../../lib/router';
import MagneticButton from './effects/MagneticButton';

const ENTRY_OPTIONS = [
  {
    title: 'Tester',
    label: 'Thesis evaluation',
    text: 'Join the research testing flow and submit feedback.',
    action: 'Continue as tester',
    path: '/login',
  },
  {
    title: 'Developer',
    label: 'Documentation tool',
    text: 'Use the C++ pattern analyzer and documentation system.',
    action: 'Continue as developer',
    path: '/developer',
  },
  {
    title: 'Student Learning',
    label: 'Beginner learning path',
    text: 'Claim a session seat, then learn design-pattern basics before using the analyzer.',
    action: 'Start learning',
    path: '/student-studio?next=/student-learning',
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
      <section className="nt-entry-shell" aria-labelledby="entry-heading">
        <div className="nt-entry-panel">
          <header className="nt-entry__hero">
            <p className="nt-section-eyebrow">Welcome to NeoTerritory</p>
            <h1 id="entry-heading" className="nt-entry__title">
              Choose how you want to enter
            </h1>
            <p className="nt-entry__lede">
              Select the path that matches your role. The analyzer stays the same behind each path.
            </p>
          </header>

          <div className="nt-entry-grid" aria-label="NeoTerritory entry paths">
            {ENTRY_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.title}
                className="nt-entry-card"
                data-role={option.title.toLowerCase().replace(/\s+/g, '-')}
                onClick={() => navigate(option.path)}
              >
                <span className="nt-entry-card__content">
                  <span className="nt-entry-card__label">{option.label}</span>
                  <span className="nt-entry-card__title">{option.title}</span>
                  <span className="nt-entry-card__text">{option.text}</span>
                </span>
                <span className="nt-entry-card__action">{option.action}</span>
              </button>
            ))}
          </div>

          <p className="nt-entry__helper">
            Not sure which one to choose? Start with Student Learning if you are new to design
            patterns.
          </p>

          <div className="nt-entry__back">
            <MagneticButton variant="ghost" onClick={() => navigate('/')}>
              Back to homepage
            </MagneticButton>
          </div>
        </div>
      </section>
    </main>
  );
}
