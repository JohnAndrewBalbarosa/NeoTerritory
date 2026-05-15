import { navigate } from '../../logic/router';

// Minimal 404 surface for retired auth paths (/choose, /login,
// /seat-selection). The homepage TryItChooser is the single auth entry
// now, so old bookmarks land here with a clear path back to / instead of
// silently being aliased to a route that no longer exists.

export default function NotFoundPage() {
  return (
    <main className="nt-notfound" id="main">
      <section className="nt-notfound__panel" aria-labelledby="notfound-heading">
        <p className="nt-section-eyebrow">404</p>
        <h1 id="notfound-heading" className="nt-notfound__title">
          That page is gone.
        </h1>
        <p className="nt-notfound__lede">
          The sign-in pages moved into the homepage popup. Head back to the homepage and click
          <strong>&nbsp;Try it now</strong>.
        </p>
        <button
          type="button"
          className="nt-notfound__back primary-btn"
          onClick={() => navigate('/')}
        >
          Go home
        </button>
      </section>
    </main>
  );
}
