import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'nt_theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

// Applies the theme to <html data-theme="..."> so CSS variable overrides take
// effect globally without re-rendering individual components.
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

// Re-apply on module load so the saved theme is in place before React mounts.
// Avoids a flash of dark on a light-mode reload.
applyTheme(readInitialTheme());

export function useTheme(): { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    applyTheme(theme);
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
