import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appState';
import { useHealth } from '../../hooks/useHealth';
import { useAuth } from '../../hooks/useAuth';
import AnalysisForm from '../analysis/AnalysisForm';
import SourceView from '../analysis/SourceView';
import PatternLegend from '../analysis/PatternLegend';
import PatternCards from '../analysis/PatternCards';
import ClassBindings from '../analysis/ClassBindings';
import RunList from '../runs/RunList';
import AmbiguityModal from '../modals/AmbiguityModal';
import SavePrompt from '../modals/SavePrompt';
import ReviewModal from '../modals/ReviewModal';
import { synthesizeUsageAnnotations } from '../../lib/usageAnnotations';
import { AnalysisRun } from '../../types/api';

interface PendingSave {
  pendingId: string;
  sourceName: string;
  patternCount: number;
  commentCount: number;
  userResolvedPattern: string | null;
}

interface AmbiguityState {
  run: AnalysisRun;
  pending: Omit<PendingSave, 'userResolvedPattern'>;
}

interface ReviewState {
  scope: string;
  analysisRunId: number | null;
  intro: string;
}

function flashLine(line: number) {
  const el = document.querySelector<HTMLElement>(`.src-line[data-line="${line}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

function flashComment(id: string) {
  const card = document.getElementById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('flash');
  setTimeout(() => card.classList.remove('flash'), 1200);
}

export default function MainLayout() {
  useHealth();
  const { status, msState, msLabel, user, currentRun, sessionRanAnalyze, sessionReviewedEnd, token } = useAppStore();
  const { signOut } = useAuth();

  const [ambiguity, setAmbiguity] = useState<AmbiguityState | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [runRefreshSignal, setRunRefreshSignal] = useState(0);

  const allAnnotations = useMemo(() => {
    if (!currentRun) return [];
    const usage = synthesizeUsageAnnotations(
      currentRun.classUsageBindings || {},
      currentRun.detectedPatterns || []
    );
    return [...(currentRun.annotations || []), ...usage];
  }, [currentRun]);

  function onAnalysisComplete(run: AnalysisRun) {
    if (!run.pendingId) return;
    const patternCount = (run.detectedPatterns || []).length;
    const commentCount = (run.annotations || []).length;
    const pending = { pendingId: run.pendingId, sourceName: run.sourceName, patternCount, commentCount };
    if (run.ranking?.verdict === 'ambiguous' && (run.ranking.ambiguousCandidates || []).length) {
      setAmbiguity({ run, pending });
    } else {
      setPendingSave({ ...pending, userResolvedPattern: null });
    }
  }

  function onAmbiguityResolved(patternId: string | null) {
    if (!ambiguity) return;
    setPendingSave({ ...ambiguity.pending, userResolvedPattern: patternId });
    setAmbiguity(null);
  }

  function onSaved(runId: number) {
    setPendingSave(null);
    setRunRefreshSignal(s => s + 1);
    setReview({ scope: 'per-run', analysisRunId: runId, intro: 'Quick rating for this run (optional):' });
  }

  async function onSignOutClick() {
    if (sessionRanAnalyze && !sessionReviewedEnd && token) {
      setReview({
        scope: 'end-of-session',
        analysisRunId: null,
        intro: 'Before you sign out — a few quick questions about this session.'
      });
      return;
    }
    signOut();
  }

  function onReviewClose(_submitted: boolean) {
    const wasEnd = review?.scope === 'end-of-session';
    setReview(null);
    if (wasEnd) {
      useAppStore.getState().setSessionReviewedEnd(true);
      signOut();
    }
  }

  const patternCount = currentRun?.detectedPatterns?.length || 0;
  const commentCount = allAnnotations.length;
  const summaryText = currentRun
    ? `${currentRun.sourceName || 'snippet.cpp'} • ${patternCount} pattern(s) • ${commentCount} comment(s)`
    : '';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">NeoTerritory Studio</p>
          <h1>Pattern detection &amp; annotation</h1>
          <p className="lede">
            Paste C++ source or upload a file. The microservice detects design patterns
            and the studio shows comments side-by-side with the lines they reference.
          </p>
        </div>
        <div id="status-card" className="status-card" data-kind={status.kind}>
          <span className="status-label">Backend</span>
          <strong id="status-title">{status.title}</strong>
          <span id="status-detail">{status.detail}</span>
          <div id="ms-row" className="ms-row" data-state={msState}>
            <span className="ms-dot" aria-hidden="true"></span>
            <span className="ms-label">Microservice:</span>
            <strong id="ms-status">{msLabel}</strong>
          </div>
          <div id="user-row" className="user-row">
            <span id="user-label">{user?.username ?? ''}</span>
            <button id="logout-btn" className="ghost-btn" type="button" onClick={onSignOutClick}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <section className="left-pane">
          <AnalysisForm onAnalysisComplete={onAnalysisComplete} />
          <RunList refreshSignal={runRefreshSignal} />
        </section>

        <section id="results-panel" className="results-panel" hidden={!currentRun}>
          {currentRun && (
            <>
              <header className="results-header">
                <p id="results-summary" className="results-summary">{summaryText}</p>
                <PatternLegend detectedPatterns={currentRun.detectedPatterns || []} />
              </header>
              <div className="results-body">
                <SourceView
                  sourceText={currentRun.sourceText || ''}
                  annotations={allAnnotations}
                  detectedPatterns={currentRun.detectedPatterns || []}
                  onLineClick={flashComment}
                />
              </div>
              <PatternCards
                detectedPatterns={currentRun.detectedPatterns || []}
                ranking={currentRun.ranking}
                userResolvedPattern={currentRun.userResolvedPattern}
                classUsageBindings={currentRun.classUsageBindings || {}}
                classUsageBindingSource={currentRun.classUsageBindingSource || 'heuristic'}
                onLineFlash={flashLine}
              />
              <ClassBindings
                bindings={currentRun.classUsageBindings || {}}
                detectedPatterns={currentRun.detectedPatterns || []}
                onLineFlash={flashLine}
              />
            </>
          )}
        </section>
      </main>

      {ambiguity && ambiguity.run.ranking && (
        <AmbiguityModal
          ranking={ambiguity.run.ranking}
          sourceName={ambiguity.run.sourceName}
          onConfirm={onAmbiguityResolved}
          onSkip={() => onAmbiguityResolved(null)}
        />
      )}
      {pendingSave && (
        <SavePrompt
          pendingId={pendingSave.pendingId}
          sourceName={pendingSave.sourceName}
          patternCount={pendingSave.patternCount}
          commentCount={pendingSave.commentCount}
          userResolvedPattern={pendingSave.userResolvedPattern}
          onSaved={onSaved}
          onDiscard={() => setPendingSave(null)}
        />
      )}
      {review && (
        <ReviewModal
          scope={review.scope}
          analysisRunId={review.analysisRunId}
          intro={review.intro}
          onClose={onReviewClose}
        />
      )}
    </div>
  );
}
