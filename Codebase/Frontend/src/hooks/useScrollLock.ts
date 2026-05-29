import { useEffect } from 'react';

// Body scroll lock shared by full-screen overlays / modal pages (any dialog
// or sheet that should pin the page behind it while it is open).
//
// Why ref-counted: more than one overlay can be open at once (e.g. a modal
// stacked over the chooser). A naive "set overflow hidden on mount, restore
// on unmount" would let the inner overlay's cleanup unlock the body while the
// outer one is still open. We count active locks and only restore the body
// when the last one releases.
//
// Why the padding-right dance: hiding the body's overflow removes the
// vertical scrollbar, which on platforms with classic (non-overlay)
// scrollbars widens the viewport and shifts the whole page left by the
// scrollbar width. We measure that width and pad the body by the same amount
// so locking is visually seamless (no layout shift). On macOS/overlay
// scrollbars the width is 0 and nothing is added.

let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

function applyLock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount > 0) {
    lockCount += 1;
    return;
  }
  const body = document.body;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPaddingRight = body.style.paddingRight;
  body.style.overflow = 'hidden';
  if (scrollbarWidth > 0) {
    const currentPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }
  lockCount = 1;
}

function releaseLock(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// Lock the body scroll while `active` is true; restore it (once the last
// active lock releases) when `active` goes false or the component unmounts.
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    applyLock();
    return () => releaseLock();
  }, [active]);
}
