import { navigate, Surface } from '../../logic/router';
import { useTheme } from '../../hooks/useTheme';

interface MarketingNavProps {
  current: Surface;
}

const LINKS: Array<{ path: string; label: string; surface: Surface }> = [
  { path: '/', label: 'Home', surface: 'hero' },
  { path: '/learn', label: 'Learn', surface: 'learn' },
  { path: '/about', label: 'About', surface: 'about' },
];

export default function MarketingNav({ current }: MarketingNavProps) {
  const { theme, toggleTheme } = useTheme();
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
      <button
        className={`theme-switch theme-switch--${theme} nt-mkt-nav__theme-switch`}
        type="button"
        role="switch"
        aria-checked={theme === 'light'}
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        <span className="ts-track" aria-hidden="true">
          <span className="ts-stars">
            <span className="ts-star ts-s1" />
            <span className="ts-star ts-s2" />
            <span className="ts-star ts-s3" />
            <span className="ts-star ts-s4" />
          </span>
          <span className="ts-thumb" />
        </span>
      </button>
      <a
        href="/choose"
        className="nt-mkt-nav__cta"
        onClick={(e) => {
          e.preventDefault();
          navigate('/choose');
        }}
      >
        Open studio
      </a>
    </header>
  );
}
