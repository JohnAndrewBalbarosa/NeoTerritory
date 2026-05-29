// "Try it now" CTA event bus. Every marketing entry point — the hero, the nav,
// the Guide ("Try it now") — dispatches TRY_IT_OPEN_EVENT; MarketingShell
// listens and routes straight to the unified learner sign-in page
// (/student-learning/login), which offers Google sign-in plus a "Use guest
// only" button.
//
// The old multi-card chooser popup (guest / sign-in / PM) was retired with
// developer mode: the product is learning-only, so there is no role to pick up
// front and both public paths land on the same learning path. The popup
// component and its seat-claim sub-view were removed; only this lightweight
// event mechanism remains so the existing CTA wiring keeps working unchanged.
// (The filename is kept to avoid churning the five call sites that import it.)

export const TRY_IT_OPEN_EVENT = 'nt:open-try-it-chooser';

export function dispatchTryItChooserOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TRY_IT_OPEN_EVENT));
}
