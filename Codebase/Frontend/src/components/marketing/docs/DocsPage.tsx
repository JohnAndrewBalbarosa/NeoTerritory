// /docs is now a popup-style overview surface. The full technical
// documentation has moved to /docs/full (publicly viewable). Visiting
// /docs renders a centered modal-style card with a short overview and a
// CTA to open the full documentation. Dismissing the modal navigates
// back to the landing.

import { useEffect } from 'react';
import { navigate } from '../../../logic/router';
import DocsMain from './sections/DocsMain';

export default function DocsPage() {
  // Esc to dismiss — matches expected modal behaviour without rebuilding
  // the focus-trap machinery for a routed surface.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') navigate('/');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="nt-docs-modal" id="main" data-testid="docs-modal-overview">
      <div
        className="nt-docs-modal__backdrop"
        role="button"
        tabIndex={0}
        aria-label="Close docs overview"
        onClick={() => navigate('/')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate('/');
          }
        }}
      />
      <section
        className="nt-docs-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-modal-title"
      >
        <header className="nt-docs-modal__head">
          <p className="nt-section-eyebrow">Docs</p>
          <h1 id="docs-modal-title" className="nt-docs-modal__title">
            CodiNeo overview
          </h1>
          <button
            type="button"
            className="nt-docs-modal__close"
            aria-label="Close docs overview"
            onClick={() => navigate('/')}
          >
            ×
          </button>
        </header>

        <DocsMain />

        <footer className="nt-docs-modal__foot">
          <button
            type="button"
            className="nt-docs-modal__cta"
            onClick={() => navigate('/docs/full')}
          >
            Open full technical documentation →
          </button>
        </footer>
      </section>
    </main>
  );
}
