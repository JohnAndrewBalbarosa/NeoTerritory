import { useEffect } from 'react';

// Dev-only viewport overflow detector.
//
// Walks the page after each resize or DOM mutation and flags any element
// whose horizontal scroll width exceeds the viewport (or its parent's
// client width + tolerance). Useful when a wide <pre>, <table>, or
// long unbreakable string sneaks past responsive rules.
//
// Logs a console.group with each offender, its scrollWidth vs
// clientWidth, and a short selector chain. Disabled in production
// builds via import.meta.env.PROD.

interface Options {
  enabled?: boolean;
  rootSelector?: string;          // limit the scan to one subtree
  tolerancePx?: number;           // ignore overflows below this delta
  intervalMs?: number;            // re-scan cadence
  ignoreSelectors?: string[];     // CSS selectors to skip
}

function shortSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur !== document.body && depth < 4) {
    let s = cur.tagName.toLowerCase();
    if (cur.id) s += `#${cur.id}`;
    if (cur.classList.length > 0) {
      s += `.${Array.from(cur.classList).slice(0, 2).join('.')}`;
    }
    parts.unshift(s);
    cur = cur.parentElement;
    depth += 1;
  }
  return parts.join(' > ');
}

export function useOverflowGuard(options: Options = {}): void {
  const {
    enabled = !((import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD),
    rootSelector,
    tolerancePx = 1,
    intervalMs = 600,
    ignoreSelectors = [],
  } = options;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    let rafId = 0;
    let timer: number | undefined;
    let lastReport = '';

    const skipMatchers = ignoreSelectors.map((s) => s);

    const scan = (): void => {
      const root = rootSelector
        ? document.querySelector(rootSelector)
        : document.body;
      if (!root) return;

      const offenders: Array<{ el: Element; delta: number }> = [];
      const all = root.querySelectorAll<HTMLElement>('*');
      const vw = window.innerWidth;

      for (const el of all) {
        if (skipMatchers.some((sel) => el.matches(sel))) continue;
        // Skip hidden nodes — overflow on display:none is a false positive.
        if (el.offsetParent === null && el !== document.body) continue;

        const rect = el.getBoundingClientRect();
        // Off-screen / collapsed elements: ignore.
        if (rect.width === 0 || rect.height === 0) continue;

        // Two checks: (1) the element pokes past the viewport, OR (2) the
        // element's content overflows its own client width by more than
        // tolerance and there is no scrollbar to absorb it.
        const pokesViewport = rect.right > vw + tolerancePx || rect.left < -tolerancePx;
        const cs = getComputedStyle(el);
        const scrollableX = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
        const overflowsSelf = !scrollableX && el.scrollWidth > el.clientWidth + tolerancePx;

        if (pokesViewport || overflowsSelf) {
          const delta = pokesViewport
            ? Math.round(rect.right - vw)
            : el.scrollWidth - el.clientWidth;
          if (delta > tolerancePx) offenders.push({ el, delta });
        }
      }

      if (offenders.length === 0) return;

      // Dedupe: keep the deepest offender per ancestry chain (the leaf
      // is the actual cause; ancestors inherit the overflow).
      const leaves = offenders.filter(
        ({ el }) => !offenders.some(({ el: other }) => other !== el && el.contains(other))
      );

      const sig = leaves
        .map((o) => `${shortSelector(o.el)}|${o.delta}`)
        .sort()
        .join('\n');
      if (sig === lastReport) return;
      lastReport = sig;

      // eslint-disable-next-line no-console
      console.group(`[overflow-guard] ${leaves.length} element(s) overflow viewport (vw=${vw}px)`);
      for (const { el, delta } of leaves) {
        // eslint-disable-next-line no-console
        console.warn(
          `+${delta}px overflow on  ${shortSelector(el)}  (scrollW=${el.scrollWidth}, clientW=${el.clientWidth})`,
          el,
        );
      }
      // eslint-disable-next-line no-console
      console.groupEnd();
    };

    const schedule = (): void => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        scan();
      });
    };

    schedule();
    timer = window.setInterval(schedule, intervalMs);

    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);

    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (timer !== undefined) window.clearInterval(timer);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [enabled, rootSelector, tolerancePx, intervalMs, ignoreSelectors]);
}
