import { useEffect, useState, type ComponentType } from 'react';
import { navigate } from '../../logic/router';
import MagneticButton from './effects/MagneticButton';
import {
  IconClipboard,
  IconCode,
  IconAcademicCap,
  IconShield,
  IconChevronRight,
} from '../icons/Icons';
import type { IconProps } from '../icons/Icons';

interface EntryOption {
  title: string;
  label: string;
  text: string;
  action: string;
  path: string;
  icon: ComponentType<IconProps>;
}

const ENTRY_OPTIONS: ReadonlyArray<EntryOption> = [
  {
    title: 'Tester',
    label: 'Thesis evaluation',
    text: 'Join the research testing flow and submit feedback.',
    action: 'Continue as tester',
    path: '/login',
    icon: IconClipboard,
  },
  {
    title: 'Developer',
    label: 'Documentation tool',
    text: 'Sign in with Google. Use the C++ pattern analyzer and documentation system on a real account.',
    action: 'Sign in as developer',
    path: '/developer/login',
    icon: IconCode,
  },
  {
    title: 'Student Learning',
    label: 'Beginner learning path',
    text: 'Sign in with Google. Learn design-pattern basics before using the analyzer.',
    action: 'Sign in to learn',
    path: '/student-learning/login',
    icon: IconAcademicCap,
  },
  {
    title: 'Admin',
    label: 'Protected dashboard',
    text: 'Manage tester seats, saved runs, feedback, logs, and exports.',
    action: 'Admin sign in',
    path: '/app',
    icon: IconShield,
  },
];

export default function EntryChoice() {
  // Mirror the admin's tester-visibility toggle: when an admin has
  // flipped testers off (admin -> Users tab -> "Show tester accounts"
  // checkbox), the Tester card disappears from this page entirely so a
  // public visitor only sees Developer / Student Learning / Admin.
  // /auth/test-accounts already publishes `testersHidden` for this
  // exact use, so we don't need a new endpoint.
  const [testersHidden, setTestersHidden] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/auth/test-accounts', { headers: { Accept: 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then((data: { testersHidden?: boolean } | null) => {
        if (!cancelled && data && typeof data.testersHidden === 'boolean') {
          setTestersHidden(data.testersHidden);
        }
      })
      .catch(() => { /* network blip — leave default (visible) */ });
    return () => { cancelled = true; };
  }, []);

  const visibleOptions = testersHidden
    ? ENTRY_OPTIONS.filter(o => o.title !== 'Tester')
    : ENTRY_OPTIONS;

  return (
    <main className="nt-entry" id="main">
      <section className="nt-entry-shell" aria-labelledby="entry-heading">
        <div className="nt-entry-panel">
          <header className="nt-entry__hero">
            <p className="nt-section-eyebrow">Welcome to CodiNeo</p>
            <h1 id="entry-heading" className="nt-entry__title">
              Choose how you want to enter
            </h1>
            <p className="nt-entry__lede">
              Select the path that matches your role. The analyzer stays the same behind each path.
            </p>
          </header>

          <div className="nt-entry-grid" aria-label="CodiNeo entry paths">
            {visibleOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.title}
                  className="nt-entry-card"
                  data-role={option.title.toLowerCase().replace(/\s+/g, '-')}
                  onClick={() => navigate(option.path)}
                >
                  <span className="nt-entry-card__icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="nt-entry-card__content">
                    <span className="nt-entry-card__label">{option.label}</span>
                    <span className="nt-entry-card__title">{option.title}</span>
                    <span className="nt-entry-card__text">{option.text}</span>
                  </span>
                  <span className="nt-entry-card__action">
                    {option.action}
                    <IconChevronRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="nt-entry__helper">
            {testersHidden
              ? 'Developer and Student Learning sign in with a Google account. Admin uses the protected dashboard credentials.'
              : 'Not sure which one to choose? Start with Student Learning if you are new to design patterns.'}
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
