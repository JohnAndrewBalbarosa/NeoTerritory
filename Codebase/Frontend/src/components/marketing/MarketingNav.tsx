import { navigate, Surface } from '../../lib/router';

interface MarketingNavProps {
  current: Surface;
}

const LINKS: Array<{ path: string; label: string; surface: Surface }> = [
  { path: '/', label: 'Home', surface: 'hero' },
  { path: '/learn', label: 'Learn', surface: 'learn' },
  { path: '/about', label: 'About', surface: 'about' },
];

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
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="16" height="11" rx="2" />
            <path d="M7 18h6M10 14v4" />
            <path d="M6 8l2 2-2 2M11 10h3" strokeWidth="1.5" />
          </svg>
        </span>
        <span className="nt-mkt-nav__brand-name">CodiNeo</span>
      </a>
      <nav aria-label="Primary" className="nt-mkt-nav__links">
        {LINKS.map((l) => (
          <a
            key={l.path}
            href={l.path}
            data-active={current === l.surface ? 'true' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(l.path);
            }}
          >
            {l.label}
          </a>
        ))}
      </nav>
      <a
        href="/app"
        className="nt-mkt-nav__cta"
        onClick={(e) => {
          e.preventDefault();
          navigate('/app');
        }}
      >
        Open studio
      </a>
    </header>
  );
}
