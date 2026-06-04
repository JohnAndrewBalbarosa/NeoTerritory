import { useEffect } from 'react';
import { useAppStore } from '../../store/appState';
import { navigate } from '../../logic/router';

export default function PreTestPage() {
  const preTestCompleted = useAppStore((s) => s.preTestCompleted);
  const setPreTestCompleted = useAppStore((s) => s.setPreTestCompleted);

  useEffect(() => {
    if (preTestCompleted) {
      navigate('/patterns/learn');
    }
  }, [preTestCompleted]);

  const handleFinish = () => {
    setPreTestCompleted(true);
    navigate('/patterns/learn');
  };

  return (
    <main className="nt-test-page" data-testid="pre-test-page">
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">Learning gate</p>
          <div className="nt-test-page__badge">LIVE</div>
          <h1 className="nt-test-page__title">Baseline Assessment: Pre-Test</h1>
          <p className="nt-test-page__lede">
            Before you enter the learning path, complete the baseline check so the app can route you
            straight into the module tree and keep this session scoped to your progress.
          </p>
        </header>

        <section className="nt-test-page__panel">
          <div className="nt-test-page__panel-head">
            <span className="nt-test-page__panel-kicker">What this unlocks</span>
            <h2 className="nt-test-page__panel-title">Direct access to the learning path</h2>
          </div>

          <p className="nt-test-page__panel-copy">
            In the full flow, this section would contain the diagnostic questions that determine your
            starting point. For now, the finish action marks the current session as pre-tested and sends
            you into the leaf-level learning view.
          </p>

          <div className="nt-test-page__callout">
            <strong>Result</strong>
            <span>Once completed, the app will skip this gate on revisit and open the learning path directly.</span>
          </div>

          <button type="button" className="nt-lesson-button nt-lesson-button--primary nt-test-page__cta" onClick={handleFinish}>
            Finish Pre-test &amp; Start Learning
          </button>
        </section>
      </div>
    </main>
  );
}
