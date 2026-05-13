import { useEffect, useState } from 'react';
import { navigate, Surface } from '../../logic/router';
import { dispatchTryItChooserOpen } from './TryItChooser';

// Updated per user feedback (post-D43): the bento doors on Home (See how
// it works, Why this matters, Pattern catalog, Take the tour, Research,
// About this thesis) are now also reachable from the top nav. Top bar is
// no longer sticky — it stays at the very top and scrolls away with the
// page. This is the new D49 (recorded in DESIGN_DECISIONS.md alongside
// this change) overriding the four-item lock from D43.

interface MarketingNavProps {
  current: Surface;
}

// Per user direction (this turn): /learn is dropped from the nav. Lesson
// content moved into /patterns/<slug> detail pages so /patterns is the
// single learning + reference surface. /learn still routes (back-compat for
// anyone who bookmarked it) but is not advertised.
const PRIMARY_LINKS: Array<{ path: string; label: string; surface: Surface | null }> = [
  { path: '/', label: 'Home', surface: 'hero' },
  { path: '/mechanics', label: 'How it works', surface: 'mechanics' },
  { path: '/patterns', label: 'Patterns', surface: 'patterns' },
  { path: '/tour', label: 'Tour', surface: 'tour' },
  { path: '/docs', label: 'Docs', surface: 'docs' },
  { path: '/about', label: 'About', surface: 'about' },
];

export default function MarketingNav({ current }: MarketingNavProps) {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Close mobile menu whenever the surface changes (i.e., the user picked
  // a destination).
  useEffect(() => {
    setMenuOpen(false);
  }, [current]);

  return (
    <header className="nt-mkt-nav nt-mkt-nav--static" role="banner">
      <a
        href="/"
        className="nt-mkt-nav__brand"
        onClick={(e) => {
          e.preventDefault();
          navigate('/');
        }}
      >
        <span className="nt-mkt-nav__brand-mark" aria-hidden>
          NT
        </span>
        <span className="nt-mkt-nav__brand-name">NeoTerritory</span>
      </a>

      <button
        type="button"
        className="nt-mkt-nav__toggle"
        aria-expanded={menuOpen}
        aria-controls="nt-mkt-primary-links"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span aria-hidden="true">{menuOpen ? '×' : '☰'}</span>
        <span className="nt-mkt-nav__toggle-label">Menu</span>
      </button>

      <nav
        id="nt-mkt-primary-links"
        aria-label="Primary"
        className="nt-mkt-nav__links"
        data-open={menuOpen ? 'true' : undefined}
      >
        {PRIMARY_LINKS.map((l) => {
          // 'patternDetail' surface should highlight the Patterns link.
          const isPatternFamily =
            l.surface === 'patterns' && (current === 'patterns' || current === 'patternDetail');
          const isActive = isPatternFamily || (l.surface !== null && current === l.surface);
          return (
            <a
              key={l.path}
              href={l.path}
              data-active={isActive ? 'true' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(l.path);
              }}
            >
              {l.label}
            </a>
          );
        })}
      </nav>

      <a
        href="/student-studio"
        className="nt-mkt-nav__cta"
        onClick={(e) => {
          e.preventDefault();
          // D76: open the path-choice modal first so the user picks
          // Learning vs Studio (and, if Studio, Tester vs Account) before
          // any navigation happens. Bypassing this used to drop users
          // straight on the tester-seat picker.
          dispatchTryItChooserOpen();
        }}
      >
        Try it now
      </a>
    </header>
  );
}
