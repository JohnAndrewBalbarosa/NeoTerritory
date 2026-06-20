import { useEffect, useState } from 'react';
import { navigate } from '../../logic/router';
import { fetchLearningAssessments } from '../../api/client';
import { useLearningModules } from '../../data/useLearningModules';
import {
  computeLearningGain,
  scoreStoredObjectiveAssessmentForCycle,
  type AssessmentScore,
  type LearningGain,
} from '../../data/learningAssessments';
import { resolvePostTestCycleId } from '../../logic/postTestEligibility';
import type { LearningAssessmentsResponse } from '../../types/api';
import { PreTestResults, PostTestResults } from './LearningAssessmentPage';

// Which result(s) to show, from the ?view= query param. The dashboard's Pre-Test
// card links with ?view=pre (Pre-Test only) and the Post-Test card with
// ?view=post (Post-Test only). Anything else shows both.
type ResultsView = 'pre' | 'post' | 'both';
function resultsView(): ResultsView {
  if (typeof window === 'undefined') return 'both';
  const v = new URLSearchParams(window.location.search).get('view');
  return v === 'pre' || v === 'post' ? v : 'both';
}

// Read-only view of the learner's stored Pre-Test and/or Post-Test results for
// their active assessment cycle. It NEVER starts or mutates an attempt — it
// re-grades the saved answers (cycle-scoped, like the Intern Dashboard) and
// renders the same result components used right after submission. Reached from
// the dashboard's "View Results" buttons on the Pre-Test and Post-Test cards.
export default function AssessmentResultsPage(): JSX.Element {
  const { modules, loaded } = useLearningModules();
  const [data, setData] = useState<LearningAssessmentsResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchLearningAssessments()
      .then((res) => { if (!cancelled) { setData(res); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, []);

  const backButton = (
    <div className="nt-assessment__footer">
      <button type="button" className="nt-lesson-button nt-lesson-button--primary" onClick={() => navigate('/intern-dashboard')}>
        Back to Dashboard
      </button>
    </div>
  );

  if (!loaded || state === 'loading') {
    return (
      <main className="nt-test-page" data-testid="assessment-results-page">
        <div className="nt-test-page__shell">
          <section className="nt-test-page__panel">
            <div className="nt-test-page__panel-head">
              <span className="nt-test-page__panel-kicker">Loading</span>
              <h1 className="nt-test-page__panel-title">Loading your results</h1>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const view = resultsView();
  const showPre = view !== 'post';
  const showPost = view !== 'pre';

  const cycleId = state === 'ready' && data ? resolvePostTestCycleId(data) : null;
  const preScore: AssessmentScore | null =
    cycleId && data ? scoreStoredObjectiveAssessmentForCycle(modules, data, 'pretest', cycleId) : null;
  const postScore: AssessmentScore | null =
    cycleId && data ? scoreStoredObjectiveAssessmentForCycle(modules, data, 'posttest', cycleId) : null;
  const gain: LearningGain | null = preScore && postScore ? computeLearningGain(preScore, postScore) : null;

  // Is there anything to show for the requested view?
  const hasContent = (showPre && preScore) || (showPost && postScore);

  if (state === 'error' || !hasContent) {
    const missing =
      view === 'post'
        ? 'You have not completed the Post-Test for your active cycle yet. It appears here once you finish it.'
        : 'There is no completed Pre-Test for your active cycle yet. Take the Pre-Test to see your results here.';
    return (
      <main className="nt-test-page" data-testid="assessment-results-page">
        <div className="nt-test-page__shell">
          <header className="nt-test-page__hero">
            <p className="nt-test-page__eyebrow">Assessment results</p>
            <h1 className="nt-test-page__title">No results yet</h1>
            <p className="nt-test-page__lede">
              {state === 'error' ? 'Your saved results could not be loaded. Please try again.' : missing}
            </p>
          </header>
          <section className="nt-test-page__panel">{backButton}</section>
        </div>
      </main>
    );
  }

  const title =
    view === 'pre' ? 'Your Pre-Test Results'
    : view === 'post' ? 'Your Post-Test Results'
    : 'Your Pre-Test & Post-Test Results';

  return (
    <main className="nt-test-page" data-testid="assessment-results-page" data-phase="results" data-view={view}>
      <div className="nt-test-page__shell">
        <header className="nt-test-page__hero">
          <p className="nt-test-page__eyebrow">Assessment results</p>
          <div className="nt-test-page__badge nt-test-page__badge--alt">CYCLE</div>
          <h1 className="nt-test-page__title">{title}</h1>
          <p className="nt-test-page__lede">
            Cycle-specific results for your current learning cycle. This view is read-only — it does not start a new attempt.
          </p>
        </header>

        {showPre && preScore ? (
          <section className="nt-test-page__panel nt-results" data-section="pretest">
            <PreTestResults score={preScore} />
            {!showPost ? backButton : null}
          </section>
        ) : null}

        {showPost ? (
          <section className="nt-test-page__panel nt-results" data-section="posttest">
            {postScore ? (
              <PostTestResults score={postScore} gain={gain} />
            ) : (
              <section className="nt-results__block">
                <h3 className="nt-results__heading">Post-Test Summary</h3>
                <p className="nt-results__note">
                  You have not completed the Post-Test for this cycle yet. Once you do, your score and learning gain appear here.
                </p>
              </section>
            )}
            {backButton}
          </section>
        ) : null}
      </div>
    </main>
  );
}
