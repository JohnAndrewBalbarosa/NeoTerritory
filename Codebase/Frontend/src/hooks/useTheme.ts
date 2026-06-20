import { useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'nt_theme';

// Light Mode is a private, surface-scoped feature: it exists ONLY inside the
// Studio and the Project Manager (admin) dashboard. Those surfaces are the only
// ones that call useTheme(); public pages (marketing landing, auth, docs,
// patterns, tour, …) never do, so they always render in the default dark theme.
//
// The theme is painted on <html data-theme="…"> so the CSS variable overrides
// (:root[data-theme="light"]) take effect globally without re-rendering
// components. The previous implementation decided whether to paint by matching
// window.location.pathname against a prefix list. That was fragile — the admin
// dashboard is served at /admin.html (not /admin), so it never matched — and it
// let the stored light preference visually "leak" onto the marketing landing
// page after sign-out.
//
// This version scopes the theme to the React lifecycle of the themed surface
// instead of to the URL: the preference is painted while the surface is mounted
// and the document is forced back to dark the moment it unmounts (sign-out, or
// navigating from the studio to a public page in the SPA bundle). Because the
// reset is tied to unmount rather than to a path check, light styling can never
// leak onto a surface that was not designed for it.

const THEMED_PATH_PREFIXES = ['/studio', '/app', '/student-studio'];

// Anti-flash only: on a hard load straight to a themed surface, decide whether
// to paint the stored preference before React mounts. Correctness (no leak) is
// enforced by the hook's mount/unmount lifecycle below, NOT by this check.
// Exported for unit testing.
export function isThemedSurfacePath(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return true; // /admin and the /admin.html bundle
  return THEMED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function readStoredTheme(): Theme {
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

// Paint the stored preference before React mounts when (and only when) the hard
// load landed directly on a themed surface — avoids a dark→light flash for
// light-mode studio/dashboard users. On every other entry point the attribute
// is left untouched so the default dark theme applies.
if (typeof window !== 'undefined' && isThemedSurfacePath(window.location.pathname)) {
  applyTheme(readStoredTheme());
}

export function useTheme(): { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    // Paint the preference while this themed surface is mounted, and remember it
    // for next time.
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage may be blocked (private mode); the runtime attribute still applies.
    }
    // When the themed surface unmounts — sign-out, or navigating from the studio
    // to a public page within the SPA — force the document back to the default
    // dark theme so light styling never leaks onto public pages.
    return () => {
      applyTheme('dark');
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme, setTheme: setThemeState };
}
