import { navigate, Surface } from '../../logic/router';

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
          NT
        </span>
        <span className="nt-mkt-nav__brand-name">NeoTerritory</span>
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
