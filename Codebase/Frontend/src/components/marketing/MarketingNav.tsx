import { navigate, Surface } from '../../logic/router';

// Per D43 (top-nav lock): exactly four items, in this order.
//   Try it    → primary CTA on the right edge → /student-studio
//   Features  → anchor to #features on the home page → /#features
//   Learn     → /learn
//   About     → /about
//
// Other surfaces (/why, /mechanics, /patterns, /tour, /research) are NOT in
// the top nav. They are reached from the Home bento grid and from
// contextual links inside Learn. Per D42 information offloading, top nav is
// the only place that names other pages.

interface MarketingNavProps {
  current: Surface;
}

const LINKS: Array<{ path: string; label: string; surface: Surface | null }> = [
  // Features is an anchor on the home page, not a separate route.
  { path: '/#features', label: 'Features', surface: null },
  { path: '/learn', label: 'Learn', surface: 'learn' },
  { path: '/about', label: 'About', surface: 'about' },
];

function navigateToFeatures(): void {
  // If we're already on /, just scroll to #features. Otherwise navigate to
  // /#features and let the hash trigger the scroll on the next render.
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/') {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  // Push the hash route; HeroLanding's useEffect picks up the hash on mount.
  window.history.pushState(null, '', '/#features');
  window.dispatchEvent(new CustomEvent('nt:navigate'));
}

export default function MarketingNav({ current }: MarketingNavProps) {
  return (
    <header className="nt-mkt-nav" role="banner">
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
      <nav aria-label="Primary" className="nt-mkt-nav__links">
        {LINKS.map((l) => (
          <a
            key={l.path}
            href={l.path}
            data-active={l.surface !== null && current === l.surface ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              if (l.path === '/#features') {
                navigateToFeatures();
              } else {
                navigate(l.path);
              }
            }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <a
        href="/student-studio"
        className="nt-mkt-nav__cta"
        onClick={(e) => {
          e.preventDefault();
          navigate('/student-studio');
        }}
      >
        Try it now
      </a>
    </header>
  );
}
