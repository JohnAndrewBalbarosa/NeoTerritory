export default function PostTest2Page() {
  return (
    <main className="nt-test-page" data-testid="post-test-2-page">
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">Learning outcome</p>
          <div className="nt-test-page__badge nt-test-page__badge--alt">POST 2</div>
          <h1 className="nt-test-page__title">Post-Test, Part 2</h1>
          <p className="nt-test-page__lede">
            The second checkpoint extends the post-test flow with follow-up questions and a final
            verification pass before the session is considered complete.
          </p>
        </header>

        <section className="nt-test-page__panel">
          <div className="nt-test-page__panel-head">
            <span className="nt-test-page__panel-kicker">Assessment layout</span>
            <h2 className="nt-test-page__panel-title">Additional questions will render here</h2>
          </div>

          <div className="nt-test-page__placeholder">
            <p>Use this surface for the follow-up items, results summary, and completion confirmation.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
