import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'nt_theme';

// Light Mode is scoped to the studio ONLY (per product direction). The stored
// preference is still remembered, but it is painted on <html data-theme> only
// while the user is on a studio-family route. Everywhere else (marketing site,
// auth, docs, patterns, tour, …) the UI is forced to dark so light styling can
// never leak onto surfaces it was not designed for. The admin dashboard
// (/admin, a separate operator bundle) keeps its own theme toggle — it is a
// private tool, not the public marketing site the leak affected.
const THEMED_PATH_PREFIXES = ['/studio', '/app', '/student-studio', '/admin'];

function isStudioPath(pathname: string): boolean {
  return THEMED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

// The theme actually painted on <html>: the stored preference on studio routes,
// forced dark everywhere else.
function effectiveTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  if (!isStudioPath(window.location.pathname)) return 'dark';
  return readStoredTheme();
}

// Applies the theme to <html data-theme="..."> so CSS variable overrides take
// effect globally without re-rendering individual components.
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

function applyEffectiveTheme(): void {
  applyTheme(effectiveTheme());
}

// Re-apply on module load so the correct theme is in place before React mounts
// (avoids a flash), and keep it correct across SPA navigation: the router fires
// `nt:navigate`, and the back/forward buttons fire `popstate`. On any route
// change we recompute whether light mode is allowed for the new path.
if (typeof window !== 'undefined') {
  applyEffectiveTheme();
  window.addEventListener('nt:navigate', applyEffectiveTheme);
  window.addEventListener('popstate', applyEffectiveTheme);
}

export function useTheme(): { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    // Persist the preference, but only paint it when the current route allows
    // light mode (studio). On non-studio routes the module-level listeners keep
    // <html> dark regardless of the stored value.
    applyEffectiveTheme();
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be blocked (private mode); the runtime attribute still applies.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, setTheme: setThemeState };
}
