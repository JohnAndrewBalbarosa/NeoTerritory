import { useEffect, useState } from 'react';

export type Surface = 'hero' | 'learn' | 'about' | 'choose' | 'studentLearning' | 'studio' | 'googleCallback' | 'googleSignIn';

const STUDIO_ALIASES = [
  '/app',
  '/login',
  '/seat-selection',
  '/consent',
  '/pretest',
  '/studio',
  '/developer',
  '/student-studio',
];

export function pathToSurface(path: string): Surface {
  if (path === '/' || path === '') return 'hero';
  if (path === '/learn' || path.startsWith('/learn/')) return 'learn';
  if (path === '/about' || path.startsWith('/about/')) return 'about';
  if (path === '/choose' || path.startsWith('/choose/')) return 'choose';
  if (path === '/auth/callback') return 'googleCallback';
  if (path === '/developer/login' || path === '/student-learning/login') return 'googleSignIn';
  if (path === '/student-learning' || path.startsWith('/student-learning/')) return 'studentLearning';
  if (STUDIO_ALIASES.some((a) => path === a || path.startsWith(`${a}/`))) return 'studio';
  return 'hero';
}

const NAV_EVENT = 'nt:navigate';

export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

// Replace-in-history variant. Used by GoogleCallback after a
// successful token exchange: we want the URL to drop the
// `#access_token=...` fragment AND the FE surface to re-render
// against the new path. Plain `history.replaceState` does neither
// the popstate nor the navigate event by itself, so without this the
// surface stays stuck on `googleCallback` even though the address bar
// already says `/studio`.
export function replaceUrl(path: string): void {
  if (typeof window === 'undefined') return;
  const samePath = window.location.pathname === path;
  const hasFragment = window.location.hash.length > 0;
  if (samePath && !hasFragment) return;
  window.history.replaceState(null, '', path);
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

export function usePath(): string {
  const initial = typeof window !== 'undefined' ? window.location.pathname : '/';
  const [path, setPath] = useState<string>(initial);

  useEffect(() => {
    const recompute = (): void => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', recompute);
    window.addEventListener(NAV_EVENT, recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener(NAV_EVENT, recompute);
    };
  }, []);

  return path;
}

export function useSurface(): Surface {
  const initial = typeof window !== 'undefined' ? window.location.pathname : '/';
  const [surface, setSurface] = useState<Surface>(pathToSurface(initial));

  useEffect(() => {
    const recompute = (): void => {
      setSurface(pathToSurface(window.location.pathname));
    };
    window.addEventListener('popstate', recompute);
    window.addEventListener(NAV_EVENT, recompute);
    return () => {
      window.removeEventListener('popstate', recompute);
      window.removeEventListener(NAV_EVENT, recompute);
    };
  }, []);

  return surface;
}
