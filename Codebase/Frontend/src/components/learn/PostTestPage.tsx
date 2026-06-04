export default function PostTestPage() {
  return (
    <main className="nt-test-page" data-testid="post-test-page">
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">Learning outcome</p>
          <div className="nt-test-page__badge nt-test-page__badge--alt">POST</div>
          <h1 className="nt-test-page__title">Post-Test</h1>
          <p className="nt-test-page__lede">
            Use this checkpoint after a module run to measure what stuck, what needs review, and
            whether the current learning path should continue to the next leaf.
          </p>
        </header>

        <section className="nt-test-page__panel">
          <div className="nt-test-page__panel-head">
            <span className="nt-test-page__panel-kicker">Assessment layout</span>
            <h2 className="nt-test-page__panel-title">Questions will render here</h2>
          </div>

          <div className="nt-test-page__placeholder">
            <p>Progress questions, answer cards, and feedback states will be mounted in this panel.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
