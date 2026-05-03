import Lenis from 'lenis';
import { useEffect } from 'react';

export function useLenis(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lenis = new Lenis({
      lerp: reduce ? 1 : 0.1,
      smoothWheel: !reduce,
    });
    let raf = 0;
    const tick = (t: number): void => {
      lenis.raf(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);
}
