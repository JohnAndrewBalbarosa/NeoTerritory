import { useEffect, useState } from 'react';

// Per D43 (top-nav lock) + D46 (/mechanics naming) + D45 (tour) + Sprint 0
// docs blueprints: /why, /mechanics, /patterns, /tour, /research are all
// public marketing surfaces. They are not in the top nav (only Try it /
// Features / Learn / About are) but they are real routes reachable from the
// Home bento grid and contextual links.
//
// Auth surface consolidation: /choose and /login are retired. All auth
// entry now flows through the TryItChooser popup mounted by
// MarketingShell, so visits to those legacy paths fall through to 'hero'
// (the marketing homepage).
export type Surface =
  | 'hero'
  | 'learn'
  | 'about'
  | 'studentLearning'
  | 'studio'
  | 'googleCallback'
  | 'googleSignIn'
  | 'why'
  | 'mechanics'
  | 'patterns'
  | 'patternDetail'
  | 'patternsLearn'
  | 'patternsLearnModule'
  | 'tour'
  | 'docs'
  | 'notFound';

// Paths retired by the auth-surface consolidation. They render the 404
// page instead of falling through to the homepage so old bookmarks land
// somewhere honest rather than silently appearing to work.
const RETIRED_PATHS = new Set<string>(['/choose', '/login', '/seat-selection']);

const STUDIO_ALIASES = [
  '/app',
  '/consent',
  '/pretest',
  '/studio',
  '/developer',
  '/student-studio',
];

export function pathToSurface(path: string): Surface {
  if (path === '/' || path === '') return 'hero';
  if (RETIRED_PATHS.has(path)) return 'notFound';
  if (path === '/learn' || path.startsWith('/learn/')) return 'learn';
  if (path === '/about' || path.startsWith('/about/')) return 'about';
  if (path === '/auth/callback') return 'googleCallback';
  if (path === '/developer/login' || path === '/student-learning/login') return 'googleSignIn';
  // /student-learning (legacy) redirects in MarketingShell to /patterns/learn
  // so old bookmarks keep working. The surface stays here just to satisfy
  // any in-flight clients on an old SPA bundle.
  if (path === '/student-learning' || path.startsWith('/student-learning/')) return 'studentLearning';
  if (path === '/why' || path.startsWith('/why/')) return 'why';
  if (path === '/mechanics' || path.startsWith('/mechanics/')) return 'mechanics';
  // Per D59: the All/GoF filter is gone. /patterns renders the unified
  // index; any deeper path is a detail page. /patterns/gof is preserved
  // as an alias back to the index for any old bookmarks.
  if (path === '/patterns' || path === '/patterns/gof') return 'patterns';
  // D77 (this turn): /patterns/learn is the new student-learning home,
  // nested under /patterns so the Patterns surface owns both the catalog
  // (reference) and the learning hub. /patterns/learn alone is the
  // category list; /patterns/learn/<slug> is one isolated module.
  if (path === '/patterns/learn') return 'patternsLearn';
  if (path.startsWith('/patterns/learn/')) return 'patternsLearnModule';
  if (path.startsWith('/patterns/')) return 'patternDetail';
  if (path === '/tour' || path.startsWith('/tour/')) return 'tour';
  // /research is the previous name; redirect-by-match so old bookmarks still land.
  if (
    path === '/docs' ||
    path.startsWith('/docs/') ||
    path === '/research' ||
    path.startsWith('/research/')
  )
    return 'docs';
  if (STUDIO_ALIASES.some((a) => path === a || path.startsWith(`${a}/`))) return 'studio';
  return 'hero';
}

// Slug helper for /patterns/<slug> detail pages. Returns the part after
// '/patterns/' (and not 'gof'). Empty string when no slug. Use only when
// pathToSurface returns 'patternDetail'.
export function patternSlugFromPath(path: string): string {
  if (!path.startsWith('/patterns/')) return '';
  const slug = path.slice('/patterns/'.length).split('/')[0];
  if (slug === 'gof' || slug === 'learn' || !slug) return '';
  return slug;
}

// D77: slug helper for /patterns/learn/<module-id>. Returns the module id,
// empty when path is just /patterns/learn (the category list).
export function learnModuleSlugFromPath(path: string): string {
  if (!path.startsWith('/patterns/learn/')) return '';
  const slug = path.slice('/patterns/learn/'.length).split('/')[0];
  return slug || '';
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
