import { useEffect, useState } from 'react';

export type Surface = 'hero' | 'learn' | 'about' | 'studio';

const STUDIO_ALIASES = ['/app', '/login', '/consent', '/pretest', '/studio'];

export function pathToSurface(path: string): Surface {
  if (path === '/' || path === '') return 'hero';
  if (path === '/learn' || path.startsWith('/learn/')) return 'learn';
  if (path === '/about' || path.startsWith('/about/')) return 'about';
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
