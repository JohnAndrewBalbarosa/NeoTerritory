import type { ComponentType } from 'react';
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
    text: 'Use the C++ pattern analyzer and documentation system.',
    action: 'Continue as developer',
    path: '/developer',
    icon: IconCode,
  },
  {
    title: 'Student Learning',
    label: 'Beginner learning path',
    text: 'Claim a session seat, then learn design-pattern basics before using the analyzer.',
    action: 'Start learning',
    path: '/student-studio?next=/student-learning',
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
            {ENTRY_OPTIONS.map((option) => {
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
